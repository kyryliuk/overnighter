"""
SageMaker model server handler for faucet classification.

SageMaker calls these four functions automatically:
    model_fn      — load model artefacts from disk
    input_fn      — decode raw request bytes into a tensor
    predict_fn    — run inference and produce a structured result
    output_fn     — serialise the result to the response body

The handler accepts ``image/jpeg`` and ``image/png`` content types and returns
``application/json``.
"""

from __future__ import annotations

import io
import json
import logging
from pathlib import Path
from typing import Any, Tuple

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

log = logging.getLogger(__name__)

_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]
_SUPPORTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg"}

# Type aliases for readability
ModelAndLabels = Tuple[nn.Module, dict[str, str]]


def _build_inference_transform() -> transforms.Compose:
    """Return the deterministic pre-processing pipeline used at inference time."""
    return transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=_IMAGENET_MEAN, std=_IMAGENET_STD),
        ]
    )


def _load_model_weights(model_dir: str | Path) -> nn.Module:
    """Reconstruct the ResNet-18 architecture and load saved weights.

    Args:
        model_dir: Directory containing ``model.pth``.

    Returns:
        Model in eval mode on CPU (SageMaker inference instances may not have GPU).

    Raises:
        FileNotFoundError: If ``model.pth`` is absent.
    """
    weights_path = Path(model_dir) / "model.pth"
    if not weights_path.exists():
        raise FileNotFoundError(f"model.pth not found in '{model_dir}'")

    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 3)
    state_dict = torch.load(weights_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()
    return model


def model_fn(model_dir: str) -> ModelAndLabels:
    """Load model artefacts from *model_dir* (called once at container start).

    Args:
        model_dir: Path supplied by SageMaker pointing to the extracted model
                   artefact directory (contains ``model.pth`` and
                   ``class_labels.json``).

    Returns:
        A ``(model, class_labels)`` tuple where *class_labels* is a dict
        mapping string indices to human-readable class names
        (e.g. ``{"0": "working", "1": "broken", "2": "no_faucet"}``).

    Raises:
        FileNotFoundError: If either artefact is missing.
    """
    model = _load_model_weights(model_dir)

    labels_path = Path(model_dir) / "class_labels.json"
    if not labels_path.exists():
        raise FileNotFoundError(f"class_labels.json not found in '{model_dir}'")
    class_labels: dict[str, str] = json.loads(labels_path.read_text())

    log.info("Model loaded from %s  |  classes: %s", model_dir, list(class_labels.values()))
    return model, class_labels


def input_fn(request_body: bytes, content_type: str) -> torch.Tensor:
    """Decode raw request bytes into a normalised image tensor.

    Args:
        request_body: Raw bytes sent by the caller.
        content_type: MIME type of the request (e.g. ``"image/jpeg"``).

    Returns:
        A float32 tensor of shape ``(1, 3, 224, 224)`` ready for the model.

    Raises:
        ValueError: If *content_type* is not a supported image format.
    """
    if content_type.lower() not in _SUPPORTED_CONTENT_TYPES:
        raise ValueError(
            f"Unsupported content type '{content_type}'. "
            f"Supported types: {sorted(_SUPPORTED_CONTENT_TYPES)}"
        )

    image = Image.open(io.BytesIO(request_body)).convert("RGB")
    transform = _build_inference_transform()
    tensor = transform(image)          # (3, 224, 224)
    return tensor.unsqueeze(0)         # (1, 3, 224, 224)


def predict_fn(data: torch.Tensor, model_and_labels: ModelAndLabels) -> dict[str, Any]:
    """Run a forward pass and produce a structured prediction.

    Args:
        data: Pre-processed image tensor with shape ``(1, 3, 224, 224)``.
        model_and_labels: The ``(model, class_labels)`` tuple returned by
                          :func:`model_fn`.

    Returns:
        A dictionary with keys:

        * ``label`` — predicted class name (str)
        * ``confidence`` — softmax probability of the top class (float, 0–1)
        * ``all_scores`` — dict mapping every class name to its probability
    """
    model, class_labels = model_and_labels

    with torch.no_grad():
        logits = model(data)                          # (1, num_classes)
        probabilities = torch.softmax(logits, dim=1)  # (1, num_classes)

    probs = probabilities.squeeze(0).tolist()          # [p0, p1, p2]
    top_idx = int(probabilities.argmax(dim=1).item())

    all_scores = {
        class_labels[str(i)]: round(float(p), 6)
        for i, p in enumerate(probs)
    }

    return {
        "label": class_labels[str(top_idx)],
        "confidence": round(float(probs[top_idx]), 6),
        "all_scores": all_scores,
    }


def output_fn(prediction: dict[str, Any], accept: str) -> Tuple[str, str]:
    """Serialise the prediction dict to the response body.

    Args:
        prediction: Dict returned by :func:`predict_fn`.
        accept: Requested response MIME type (e.g. ``"application/json"``).

    Returns:
        A ``(body, content_type)`` tuple.  The body is always JSON regardless
        of the *accept* header, as this handler only supports JSON output.
    """
    body = json.dumps(prediction, ensure_ascii=False)
    return body, "application/json"
