# Faucet Classifier — ML Module

ResNet-18 transfer learning model that classifies images as **working**, **broken**, or **no_faucet**. Compatible with AWS SageMaker training and hosting.

---

## 1. Local smoke test

No data required — the script detects the missing data directory and runs one epoch on synthetic tensors.

```bash
cd ml
pip install -r requirements.txt
python train.py
```

Expected output:

```
00:00:01  INFO     Device: cpu
00:00:01  WARNING  Real data not found. Running smoke test with dummy tensors (1 epoch).
00:00:05  INFO     Epoch   1/1 | train loss 1.0923 acc 0.3594 | val loss 1.0891 acc 0.3750 | 4.2s
00:00:05  INFO     Training complete. Best accuracy: 0.3750
00:00:05  INFO     Saved model → /opt/ml/model/model.pth
```

A `model.pth` and `class_labels.json` are written to the `--model-dir` (default `/opt/ml/model`).

---

## 2. Full SageMaker training job

```python
import sagemaker
from sagemaker.pytorch import PyTorch

role = sagemaker.get_execution_role()   # IAM role with S3 + SageMaker access

estimator = PyTorch(
    entry_point="train.py",
    source_dir="ml/",                   # uploads all files in this directory
    role=role,
    framework_version="2.1",
    py_version="py310",
    instance_type="ml.p3.2xlarge",      # single-GPU instance
    instance_count=1,
    hyperparameters={
        "epochs": 20,
        "batch-size": 32,
        "learning-rate": 0.001,
    },
)

# Upload data to S3 first, then point the estimator at the S3 prefix
training_data_uri = "s3://your-bucket/faucet-data/"   # contains train/ and val/ directories

estimator.fit({"training": training_data_uri})
```

SageMaker will automatically set `--data-dir` to the mounted S3 path and `--model-dir` to `/opt/ml/model`.

---

## 3. Deploy to a SageMaker endpoint

```python
from sagemaker.pytorch import PyTorchModel

model = PyTorchModel(
    model_data=estimator.model_data,    # S3 URI to model.tar.gz produced by training
    role=role,
    framework_version="2.1",
    py_version="py310",
    entry_point="inference.py",
    source_dir="ml/",
)

predictor = model.deploy(
    initial_instance_count=1,
    instance_type="ml.m5.large",
)

# Run inference
import json
with open("test_faucet.jpg", "rb") as f:
    image_bytes = f.read()

response = predictor.predict(image_bytes, initial_args={"ContentType": "image/jpeg"})
print(json.loads(response))
# {"label": "working", "confidence": 0.9241, "all_scores": {...}}

# Tear down when done
predictor.delete_endpoint()
```

---

## 4. Dataset preparation

### Option A — Google Open Images (recommended)

1. Install the downloader:
   ```bash
   pip install openimages
   ```

2. Download faucet images (OIDv6 class `/m/03g9zj`):
   ```bash
   oid_download_subsets \
       --classes "Faucet" \
       --type_data train validation \
       --limit 500
   ```

3. Organise into the expected layout:
   ```
   data/
     train/
       working/      # ≥ 200 images
       broken/       # ≥ 200 images
       no_faucet/    # ≥ 200 images (sinks, bathrooms, etc.)
     val/
       working/
       broken/
       no_faucet/
   ```

4. Run the helper for detailed instructions:
   ```bash
   python dataset.py
   ```

### Option B — Roboflow Universe

Search [https://universe.roboflow.com/?q=faucet](https://universe.roboflow.com/?q=faucet) for pre-labelled faucet datasets and export in the folder format above.

### Labelling guide

| Class | Description |
|---|---|
| `working` | Faucet clearly visible, no signs of damage or leaking |
| `broken` | Visible cracks, leaks, missing handles, or corroded fixtures |
| `no_faucet` | Image contains no faucet (used as a negative / rejection class) |
