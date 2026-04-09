"""
SageMaker-compatible PyTorch training script for faucet classification.

Usage (local smoke test — no data required):
    python train.py

Usage (full training with real data):
    python train.py \\
        --epochs 20 \\
        --batch-size 32 \\
        --learning-rate 0.001 \\
        --data-dir /path/to/data \\
        --model-dir ./models

SageMaker will call this script automatically, injecting hyperparameters and
the SM_* environment variables that set --data-dir and --model-dir.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from torchvision import models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# SageMaker Experiments integration — optional
try:
    from sagemaker.experiments.run import Run  # type: ignore

    _SM_EXPERIMENTS_AVAILABLE = True
except ImportError:
    _SM_EXPERIMENTS_AVAILABLE = False
    log.info("sagemaker.experiments not available — metrics logged to stdout only.")

NUM_CLASSES = 3
CLASS_LABELS = {"0": "working", "1": "broken", "2": "no_faucet"}


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------


def build_model(num_classes: int = NUM_CLASSES, freeze_backbone: bool = True) -> nn.Module:
    """Build a ResNet-18 model with a custom classification head.

    The ImageNet-pretrained backbone is frozen by default; only the final
    fully-connected layer is trainable.  This makes fine-tuning fast even
    on small datasets.

    Args:
        num_classes: Number of output classes.
        freeze_backbone: If True, all layers except the FC head are frozen.

    Returns:
        A ``torchvision.models.ResNet`` instance ready for training.
    """
    weights = models.ResNet18_Weights.DEFAULT
    model = models.resnet18(weights=weights)

    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # Replace the final FC layer
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)  # only this is trainable

    return model


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------


def _get_real_loaders(
    data_dir: Path, batch_size: int
) -> Tuple[DataLoader, Optional[DataLoader]]:
    """Create DataLoaders from the on-disk image dataset.

    Args:
        data_dir: Root directory containing ``train/`` and optionally ``val/``
                  sub-directories.
        batch_size: Mini-batch size for both loaders.

    Returns:
        A ``(train_loader, val_loader)`` tuple.  *val_loader* is ``None`` when
        no validation split is found.
    """
    # Dataset import is local to avoid issues when running as a SM entry point
    # where the working directory may differ.
    script_dir = Path(__file__).parent
    if str(script_dir) not in sys.path:
        sys.path.insert(0, str(script_dir))

    from dataset import FaucetDataset, build_transforms  # noqa: PLC0415

    train_ds = FaucetDataset(data_dir / "train", transform=build_transforms(augment=True))
    train_loader = DataLoader(
        train_ds, batch_size=batch_size, shuffle=True, num_workers=2, pin_memory=True
    )

    val_loader: Optional[DataLoader] = None
    val_dir = data_dir / "val"
    if val_dir.is_dir():
        val_ds = FaucetDataset(val_dir, transform=build_transforms(augment=False))
        val_loader = DataLoader(
            val_ds, batch_size=batch_size, shuffle=False, num_workers=2, pin_memory=True
        )

    log.info("Train samples: %d", len(train_ds))
    if val_loader:
        log.info("Val samples:   %d", len(val_ds))  # type: ignore[possibly-undefined]

    return train_loader, val_loader


def _get_dummy_loaders(batch_size: int) -> Tuple[DataLoader, DataLoader]:
    """Create tiny synthetic DataLoaders for a local smoke test.

    Generates 64 random tensors with random labels — enough to confirm that
    the training loop, loss, and checkpointing all work without real data.

    Args:
        batch_size: Mini-batch size.

    Returns:
        ``(train_loader, val_loader)`` backed by random tensors.
    """
    log.warning(
        "Real data not found. Running smoke test with dummy tensors (1 epoch)."
    )
    n = 64
    x = torch.randn(n, 3, 224, 224)
    y = torch.randint(0, NUM_CLASSES, (n,))
    ds = TensorDataset(x, y)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True)
    return loader, loader  # reuse for val


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------


def _run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: Optional[torch.optim.Optimizer],
    device: torch.device,
    phase: str,
) -> Tuple[float, float]:
    """Run one full pass over *loader* in train or eval mode.

    Args:
        model: The neural network.
        loader: DataLoader for the current phase.
        criterion: Loss function.
        optimizer: Optimiser (only used when *phase* is ``"train"``).
        device: Compute device.
        phase: Either ``"train"`` or ``"val"``.

    Returns:
        ``(avg_loss, accuracy)`` for the epoch.
    """
    is_train = phase == "train"
    model.train() if is_train else model.eval()

    running_loss = 0.0
    correct = 0
    total = 0

    ctx = torch.enable_grad() if is_train else torch.no_grad()
    with ctx:  # type: ignore[attr-defined]
        for inputs, labels in loader:
            inputs, labels = inputs.to(device), labels.to(device)

            if is_train and optimizer is not None:
                optimizer.zero_grad()

            outputs = model(inputs)
            loss = criterion(outputs, labels)

            if is_train and optimizer is not None:
                loss.backward()
                optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            preds = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    avg_loss = running_loss / total
    accuracy = correct / total
    return avg_loss, accuracy


def train(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: Optional[DataLoader],
    epochs: int,
    lr: float,
    model_dir: Path,
    device: torch.device,
) -> None:
    """Full training procedure with optional SageMaker Experiments logging.

    Args:
        model: ResNet model to train.
        train_loader: Training DataLoader.
        val_loader: Validation DataLoader (may be ``None``).
        epochs: Total number of epochs.
        lr: Adam learning rate.
        model_dir: Directory where ``model.pth`` will be saved.
        device: Target compute device.
    """
    model.to(device)
    criterion = nn.CrossEntropyLoss()
    # Only optimise the (unfrozen) FC head parameters
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()), lr=lr
    )
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)

    sm_run = None
    if _SM_EXPERIMENTS_AVAILABLE:
        try:
            sm_run = Run.load()  # picks up SM_HP_* env vars automatically
        except Exception:
            pass  # not inside a SageMaker training job — that's fine

    best_val_acc = 0.0

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        train_loss, train_acc = _run_epoch(
            model, train_loader, criterion, optimizer, device, "train"
        )
        scheduler.step()

        val_loss, val_acc = 0.0, 0.0
        if val_loader:
            val_loss, val_acc = _run_epoch(
                model, val_loader, criterion, None, device, "val"
            )

        elapsed = time.time() - t0
        log.info(
            "Epoch %3d/%d | train loss %.4f acc %.4f | val loss %.4f acc %.4f | %.1fs",
            epoch,
            epochs,
            train_loss,
            train_acc,
            val_loss,
            val_acc,
            elapsed,
        )

        if sm_run is not None:
            try:
                sm_run.log_metric("train:loss", train_loss, step=epoch)
                sm_run.log_metric("train:accuracy", train_acc, step=epoch)
                if val_loader:
                    sm_run.log_metric("val:loss", val_loss, step=epoch)
                    sm_run.log_metric("val:accuracy", val_acc, step=epoch)
            except Exception:
                pass

        # Save best checkpoint based on val accuracy (or train if no val split)
        score = val_acc if val_loader else train_acc
        if score >= best_val_acc:
            best_val_acc = score
            _save_checkpoint(model, model_dir)

    log.info("Training complete. Best accuracy: %.4f", best_val_acc)


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def _save_checkpoint(model: nn.Module, model_dir: Path) -> None:
    """Persist the model weights and class label mapping.

    Args:
        model: Trained model whose ``state_dict`` will be saved.
        model_dir: Target directory.  Created if it does not exist.
    """
    model_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), model_dir / "model.pth")

    labels_path = model_dir / "class_labels.json"
    labels_path.write_text(json.dumps(CLASS_LABELS, indent=2))
    log.info("Saved model → %s", model_dir / "model.pth")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """Parse command-line and SageMaker environment hyperparameters."""
    parser = argparse.ArgumentParser(description="Faucet classifier training script")

    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    # SageMaker injects these via environment variables as well
    parser.add_argument(
        "--model-dir",
        type=str,
        default=os.environ.get("SM_MODEL_DIR", "/opt/ml/model"),
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=os.environ.get("SM_CHANNEL_TRAINING", "/opt/ml/input/data/training"),
    )

    return parser.parse_args()


def main() -> None:
    """Script entry point."""
    args = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info("Device: %s", device)
    log.info("Hyperparameters: %s", vars(args))

    model = build_model()

    data_dir = Path(args.data_dir)
    smoke_test = not (data_dir / "train").is_dir()

    if smoke_test:
        train_loader, val_loader = _get_dummy_loaders(args.batch_size)
        epochs = 1  # single epoch for smoke test
    else:
        train_loader, val_loader = _get_real_loaders(data_dir, args.batch_size)
        epochs = args.epochs

    train(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        epochs=epochs,
        lr=args.learning_rate,
        model_dir=Path(args.model_dir),
        device=device,
    )


if __name__ == "__main__":
    main()
