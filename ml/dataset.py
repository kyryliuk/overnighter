"""
FaucetDataset — PyTorch Dataset for water faucet image classification.

Directory layout expected:
    data/
      train/
        working/    *.jpg / *.png
        broken/     *.jpg / *.png
        no_faucet/  *.jpg / *.png
      val/
        working/
        broken/
        no_faucet/
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, Optional, Tuple

from PIL import Image
from torch import Tensor
from torch.utils.data import Dataset
from torchvision import transforms

# Canonical label mapping used across training and inference
CLASS_LABELS: dict[int, str] = {0: "working", 1: "broken", 2: "no_faucet"}
LABEL_TO_IDX: dict[str, int] = {v: k for k, v in CLASS_LABELS.items()}

_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]


def build_transforms(augment: bool = False) -> Callable:
    """Return a torchvision transform pipeline.

    Args:
        augment: If True, add random flips and colour jitter (use for training).

    Returns:
        A composed transform that resizes to 224×224, converts to tensor, and
        applies ImageNet normalisation.
    """
    base = [transforms.Resize(256), transforms.CenterCrop(224)]

    if augment:
        base = [
            transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
        ]

    return transforms.Compose(
        base
        + [
            transforms.ToTensor(),
            transforms.Normalize(mean=_IMAGENET_MEAN, std=_IMAGENET_STD),
        ]
    )


class FaucetDataset(Dataset):
    """Image dataset for three-class faucet classification.

    Args:
        root: Path to the split root (e.g. ``data/train`` or ``data/val``).
        transform: Optional transform applied to each PIL image.  When *None*
            the standard ImageNet pipeline (no augmentation) is used.
    """

    def __init__(
        self,
        root: str | Path,
        transform: Optional[Callable] = None,
    ) -> None:
        self.root = Path(root)
        self.transform = transform or build_transforms(augment=False)
        self.samples: list[Tuple[Path, int]] = []
        self._load_samples()

    def _load_samples(self) -> None:
        """Walk the class sub-directories and collect (path, label) pairs."""
        for class_name, idx in LABEL_TO_IDX.items():
            class_dir = self.root / class_name
            if not class_dir.is_dir():
                continue
            for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
                for img_path in sorted(class_dir.glob(ext)):
                    self.samples.append((img_path, idx))

        if not self.samples:
            raise FileNotFoundError(
                f"No images found under '{self.root}'. "
                "Expected sub-directories: working/, broken/, no_faucet/"
            )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> Tuple[Tensor, int]:
        """Return (image_tensor, label_index) for the given index."""
        img_path, label = self.samples[index]
        image = Image.open(img_path).convert("RGB")
        return self.transform(image), label


def download_sample_data() -> None:
    """Print instructions for obtaining faucet training data from Google Open Images.

    This function does *not* perform any network requests.  Follow the printed
    guidance to prepare the dataset before running ``train.py``.
    """
    instructions = """
=============================================================
  Faucet Dataset — Download Instructions (Google Open Images)
=============================================================

1. Install the Open Images downloader:
   pip install openimages

2. Download faucet images (the OIDv6 class label is "/m/03g9zj"):
   oid_download_subsets \\
       --classes "Faucet" \\
       --type_data train validation \\
       --multiclasses 0 \\
       --limit 500

3. Organise the downloaded images into the expected directory layout:

   data/
     train/
       working/    # manually curated working-faucet images
       broken/     # manually curated broken-faucet images
       no_faucet/  # negative examples (general indoor scenes, plumbing)
     val/
       working/
       broken/
       no_faucet/

4. Recommended split: 80 % train / 20 % val.  Aim for ≥ 200 images per class.

5. Negative examples ("no_faucet") can be sourced from the Open Images
   categories "Sink", "Bathroom", or "Plumbing fixture".

6. Alternatively, use Roboflow Universe to search for pre-labelled faucet
   datasets: https://universe.roboflow.com/?q=faucet

Once the data folder is in place, run:
   cd ml && python train.py
=============================================================
"""
    print(instructions)


if __name__ == "__main__":
    download_sample_data()
