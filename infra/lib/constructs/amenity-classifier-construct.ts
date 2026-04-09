import * as cdk from 'aws-cdk-lib';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

export interface AmenityClassifierProps {
  /** Logical name used for all child resource IDs (e.g. "Pool", "Gym"). */
  modelName: string;
  /** S3 URI pointing to the model.tar.gz artefact, e.g.
   *  s3://overnighter-ml-artifacts/model-artifacts/pool/v2/model.tar.gz */
  modelArtifactS3Uri: string;
  /** ARN of the IAM role that SageMaker assumes to load the model. */
  executionRoleArn: string;
  /**
   * SageMaker instance type for the endpoint variant.
   * Defaults to ml.t2.medium — suitable for low-traffic classifiers.
   * Use ml.m5.large or larger for production throughput.
   */
  instanceType?: string;
}

/**
 * AmenityClassifierConstruct — reusable L3 construct that wires together a
 * SageMaker Model, EndpointConfig, and Endpoint for a single amenity type.
 *
 * Usage example (adding a second "pool" classifier alongside the faucet one):
 *
 * ```ts
 * new AmenityClassifierConstruct(this, 'PoolClassifier', {
 *   modelName: 'Pool',
 *   modelArtifactS3Uri: `s3://${mlBucket.bucketName}/model-artifacts/pool/v1/model.tar.gz`,
 *   executionRoleArn: sageMakerRole.roleArn,
 *   instanceType: 'ml.m5.large',
 * });
 * ```
 *
 * Each instance creates its own isolated Model + EndpointConfig + Endpoint so
 * that classifiers can be updated, scaled, or destroyed independently.
 */
export class AmenityClassifierConstruct extends Construct {
  /** The live SageMaker endpoint; use `endpoint.ref` to get the endpoint name. */
  public readonly endpoint: sagemaker.CfnEndpoint;

  constructor(scope: Construct, id: string, props: AmenityClassifierProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);
    const instanceType = props.instanceType ?? 'ml.t2.medium';

    // Build the ECR image URI using the parent stack's account and region so
    // this construct is portable across environments without code changes.
    const imageUri = `${stack.account}.dkr.ecr.${stack.region}.amazonaws.com/overnighter-inference:latest`;

    // Model — maps a container image to its serialised weights in S3.
    const cfnModel = new sagemaker.CfnModel(this, `${props.modelName}Model`, {
      modelName: `Overnighter${props.modelName}Model`,
      executionRoleArn: props.executionRoleArn,
      primaryContainer: {
        image: imageUri,
        modelDataUrl: props.modelArtifactS3Uri,
      },
    });

    // EndpointConfig — declares the instance shape for the serving fleet.
    const cfnEndpointConfig = new sagemaker.CfnEndpointConfig(
      this,
      `${props.modelName}EndpointConfig`,
      {
        endpointConfigName: `Overnighter${props.modelName}EndpointConfig`,
        productionVariants: [
          {
            variantName: 'AllTraffic',
            modelName: cfnModel.modelName!,
            instanceType,
            initialInstanceCount: 1,
            initialVariantWeight: 1.0,
          },
        ],
      }
    );
    cfnEndpointConfig.addDependency(cfnModel);

    // Endpoint — the live HTTPS surface exposed to the Lambda proxy.
    this.endpoint = new sagemaker.CfnEndpoint(
      this,
      `${props.modelName}Endpoint`,
      {
        endpointName: `Overnighter${props.modelName}Endpoint`,
        endpointConfigName: cfnEndpointConfig.endpointConfigName!,
      }
    );
    this.endpoint.addDependency(cfnEndpointConfig);
  }
}
