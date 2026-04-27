"""
Deploy the faucet classifier to a SageMaker real-time endpoint using boto3 directly.

Usage:
    python ml/deploy.py --role arn:aws:iam::ACCOUNT_ID:role/SageMakerExecutionRole
"""

import argparse
import json
import os
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import boto3

ENDPOINT_NAME = "overnighter-faucet-classifier"
MODEL_NAME = "overnighter-faucet-classifier"
ENDPOINT_CONFIG_NAME = "overnighter-faucet-classifier-config"
INSTANCE_TYPE = "ml.m5.large"

# AWS Deep Learning Container — PyTorch 2.1 CPU inference
PYTORCH_IMAGE = (
    "763104351884.dkr.ecr.{region}.amazonaws.com"
    "/pytorch-inference:2.1.0-cpu-py310"
)

ROOT = Path(__file__).parent


def package_model(tmp_dir: str) -> str:
    archive_path = os.path.join(tmp_dir, "model.tar.gz")
    with tarfile.open(archive_path, "w:gz") as tar:
        for filename in ["model.pth", "class_labels.json"]:
            src = ROOT / "models" / filename
            if not src.exists():
                sys.exit(f"ERROR: {src} not found")
            tar.add(src, arcname=filename)
        tar.add(ROOT / "inference.py", arcname="inference.py")
    print(f"  Packaged -> {archive_path}")
    return archive_path


def ensure_bucket(s3, bucket: str, region: str) -> None:
    try:
        s3.head_bucket(Bucket=bucket)
        print(f"  S3 bucket exists: s3://{bucket}")
    except Exception:
        kwargs = {"Bucket": bucket}
        if region != "us-east-1":
            kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region}
        s3.create_bucket(**kwargs)
        print(f"  Created S3 bucket: s3://{bucket}")


def upload_model(s3, archive_path: str, bucket: str, key: str) -> str:
    print(f"  Uploading to s3://{bucket}/{key} ...")
    s3.upload_file(archive_path, bucket, key)
    return f"s3://{bucket}/{key}"


def wait_for_endpoint(sm, endpoint_name: str) -> None:
    print("  Waiting for endpoint to be InService", end="", flush=True)
    while True:
        resp = sm.describe_endpoint(EndpointName=endpoint_name)
        status = resp["EndpointStatus"]
        if status == "InService":
            print(" done.")
            return
        if status in ("Failed", "RollingBack"):
            reason = resp.get("FailureReason", "unknown")
            sys.exit(f"\nERROR: Endpoint failed — {reason}")
        print(".", end="", flush=True)
        time.sleep(20)


def deploy(role_arn: str, model_s3_uri: str, region: str) -> str:
    sm = boto3.client("sagemaker", region_name=region)
    image = PYTORCH_IMAGE.format(region=region)

    # Delete existing resources if they exist (re-deploy case)
    for res, delete_fn, describe_fn, key in [
        (ENDPOINT_NAME, sm.delete_endpoint, sm.describe_endpoint, "EndpointName"),
        (ENDPOINT_CONFIG_NAME, sm.delete_endpoint_config, sm.describe_endpoint_config, "EndpointConfigName"),
        (MODEL_NAME, sm.delete_model, sm.describe_model, "ModelName"),
    ]:
        try:
            describe_fn(**{key: res})
            print(f"  Removing existing {key}={res}")
            delete_fn(**{key: res})
            time.sleep(2)
        except sm.exceptions.ClientError:
            pass

    print(f"  Creating SageMaker model...")
    sm.create_model(
        ModelName=MODEL_NAME,
        ExecutionRoleArn=role_arn,
        PrimaryContainer={
            "Image": image,
            "ModelDataUrl": model_s3_uri,
            "Environment": {
                "SAGEMAKER_PROGRAM": "inference.py",
                "SAGEMAKER_SUBMIT_DIRECTORY": model_s3_uri,
            },
        },
    )

    print(f"  Creating endpoint config...")
    sm.create_endpoint_config(
        EndpointConfigName=ENDPOINT_CONFIG_NAME,
        ProductionVariants=[{
            "VariantName": "primary",
            "ModelName": MODEL_NAME,
            "InitialInstanceCount": 1,
            "InstanceType": INSTANCE_TYPE,
        }],
    )

    print(f"  Creating endpoint '{ENDPOINT_NAME}'...")
    sm.create_endpoint(
        EndpointName=ENDPOINT_NAME,
        EndpointConfigName=ENDPOINT_CONFIG_NAME,
    )

    wait_for_endpoint(sm, ENDPOINT_NAME)
    return ENDPOINT_NAME


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", required=True, help="SageMaker execution role ARN")
    parser.add_argument("--region", default="us-east-1")
    args = parser.parse_args()

    region = args.region
    sts = boto3.client("sts", region_name=region)
    account_id = sts.get_caller_identity()["Account"]
    bucket = f"overnighter-ml-models-{account_id}"
    s3_key = "faucet-classifier/model.tar.gz"
    s3 = boto3.client("s3", region_name=region)

    print("\n[1/4] Packaging model artifacts...")
    with tempfile.TemporaryDirectory() as tmp:
        archive = package_model(tmp)

        print("\n[2/4] Ensuring S3 bucket...")
        ensure_bucket(s3, bucket, region)

        print("\n[3/4] Uploading model to S3...")
        model_s3_uri = upload_model(s3, archive, bucket, s3_key)

    print("\n[4/4] Deploying SageMaker endpoint...")
    endpoint_name = deploy(args.role, model_s3_uri, region)

    endpoint_url = (
        f"https://runtime.sagemaker.{region}.amazonaws.com"
        f"/endpoints/{endpoint_name}/invocations"
    )

    print("\n" + "=" * 60)
    print("Deployment complete!")
    print(f"  SAGEMAKER_ENDPOINT_NAME = {endpoint_name}")
    print(f"  SAGEMAKER_ENDPOINT_URL  = {endpoint_url}")
    print("=" * 60)


if __name__ == "__main__":
    main()
