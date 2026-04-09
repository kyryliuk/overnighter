import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

export class OvernighterAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -----------------------------------------------------------------------
    // S3 Bucket — central store for ML training data and serialized models.
    // Two logical prefixes are used at runtime:
    //   training-data/  → raw and pre-processed datasets uploaded by ETL jobs
    //   model-artifacts/ → tar.gz artefacts produced by SageMaker training jobs
    // -----------------------------------------------------------------------
    const mlBucket = new s3.Bucket(this, 'MlArtifactsBucket', {
      bucketName: `overnighter-ml-artifacts-${this.account}-${this.region}`,
      versioned: true, // keeps every model version recoverable
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          // Incomplete multipart uploads silently accumulate storage cost;
          // abort them after 7 days to keep the bucket tidy.
          id: 'AbortIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          enabled: true,
        },
      ],
    });

    // -----------------------------------------------------------------------
    // ECR Repository — stores the Docker image used by the SageMaker endpoint.
    // MUTABLE tags let the CI/CD pipeline overwrite :latest on every build
    // while the lifecycle rule caps storage costs at the 10 most recent images.
    // -----------------------------------------------------------------------
    const ecrRepo = new ecr.Repository(this, 'InferenceRepository', {
      repositoryName: 'overnighter-inference',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          // Prune old images to avoid unbounded ECR storage growth.
          description: 'Keep only last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // -----------------------------------------------------------------------
    // IAM Role — SageMaker assumes this role at inference time to pull the
    // container from ECR and read model artefacts from S3.
    // AmazonSageMakerFullAccess covers managed service permissions;
    // the inline policies narrow S3 and ECR access to only what is needed.
    // -----------------------------------------------------------------------
    const sageMakerRole = new iam.Role(this, 'SageMakerExecutionRole', {
      roleName: 'OvernighterSageMakerExecutionRole',
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

    // Scope S3 access to the ML artefacts bucket only (principle of least privilege).
    sageMakerRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3MlBucketAccess',
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: [mlBucket.bucketArn, `${mlBucket.bucketArn}/*`],
      })
    );

    // Allow SageMaker to pull the inference image from ECR.
    sageMakerRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'EcrReadAccess',
        actions: [
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetAuthorizationToken',
        ],
        resources: [ecrRepo.repositoryArn, '*'], // GetAuthorizationToken requires '*'
      })
    );

    // -----------------------------------------------------------------------
    // SageMaker Model (L1/Cfn) — ties together the inference container image
    // and the model artefact stored in S3.  CDK does not yet provide L2
    // constructs for SageMaker models, so we use CfnModel directly.
    // The image URI pattern follows the standard ECR private registry format.
    // -----------------------------------------------------------------------
    const cfnModel = new sagemaker.CfnModel(this, 'OvernighterFaucetModel', {
      modelName: 'OvernighterFaucetModel',
      executionRoleArn: sageMakerRole.roleArn,
      primaryContainer: {
        // Build the ECR image URI from the stack's resolved account + region
        // so the same template works in any environment after bootstrapping.
        image: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/overnighter-inference:latest`,
        modelDataUrl: `s3://${mlBucket.bucketName}/model-artifacts/v1/model.tar.gz`,
      },
    });

    // -----------------------------------------------------------------------
    // SageMaker Endpoint Configuration — defines the compute shape used to
    // serve the model.  ml.t2.medium is the smallest non-free tier instance
    // and is sufficient for low-traffic demo/homework workloads.
    // -----------------------------------------------------------------------
    const cfnEndpointConfig = new sagemaker.CfnEndpointConfig(
      this,
      'OvernighterEndpointConfig',
      {
        endpointConfigName: 'OvernighterEndpointConfig',
        productionVariants: [
          {
            variantName: 'AllTraffic',
            modelName: cfnModel.modelName!,
            instanceType: 'ml.t2.medium',
            initialInstanceCount: 1,
            initialVariantWeight: 1.0,
          },
        ],
      }
    );
    // Ensure the model exists before the endpoint config references it.
    cfnEndpointConfig.addDependency(cfnModel);

    // -----------------------------------------------------------------------
    // SageMaker Endpoint — the live HTTPS endpoint that serves predictions.
    // This is what the Lambda proxy calls at inference time.
    // -----------------------------------------------------------------------
    const cfnEndpoint = new sagemaker.CfnEndpoint(this, 'OvernighterEndpoint', {
      endpointName: 'OvernighterEndpoint',
      endpointConfigName: cfnEndpointConfig.endpointConfigName!,
    });
    cfnEndpoint.addDependency(cfnEndpointConfig);

    // -----------------------------------------------------------------------
    // Lambda Function — thin HTTP proxy that translates API Gateway events
    // into SageMaker InvokeEndpoint calls and normalises the response.
    // Using inline code avoids a build + S3 upload step for this small shim;
    // for production workloads, switch to lambda.Code.fromAsset().
    // Falls back to a mock response when SAGEMAKER_ENDPOINT_NAME is not set
    // (useful for local testing / CI environments without real AWS access).
    // -----------------------------------------------------------------------
    const proxyFn = new lambda.Function(this, 'FaucetClassifierProxy', {
      functionName: 'OvernighterFaucetClassifierProxy',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      environment: {
        // Passes the resolved endpoint name at deploy time; Lambda reads this
        // at invocation time so no hard-coded strings end up in the code.
        SAGEMAKER_ENDPOINT_NAME: cfnEndpoint.ref,
      },
      code: lambda.Code.fromInline(`
const { SageMakerRuntimeClient, InvokeEndpointCommand } = require('@aws-sdk/client-sagemaker-runtime');

exports.handler = async (event) => {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME;

  // Return a deterministic mock when no endpoint is configured so the API
  // stays testable in offline / CI environments.
  if (!endpointName) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'working', confidence: 0.92 }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const client = new SageMakerRuntimeClient({});
    const cmd = new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: Buffer.from(JSON.stringify(body)),
    });

    const response = await client.send(cmd);
    const result = JSON.parse(Buffer.from(response.Body).toString('utf-8'));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: result.label,
        confidence: result.confidence,
      }),
    };
  } catch (err) {
    console.error('SageMaker invocation error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Inference failed', details: String(err) }),
    };
  }
};
      `.trim()),
    });

    // Allow the Lambda execution role to call InvokeEndpoint on this specific
    // endpoint only — avoids granting broad SageMaker access.
    proxyFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'InvokeSageMakerEndpoint',
        actions: ['sagemaker:InvokeEndpoint'],
        resources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:endpoint/${cfnEndpoint.ref}`,
        ],
      })
    );

    // -----------------------------------------------------------------------
    // API Gateway — public REST API that fronts the Lambda proxy.
    // CORS is enabled so browser-based clients (the React front-end) can call
    // the /classify endpoint directly without a custom proxy server.
    // -----------------------------------------------------------------------
    const api = new apigateway.RestApi(this, 'FaucetClassifierApi', {
      restApiName: 'OvernighterFaucetClassifierApi',
      description: 'REST API for the Overnighter faucet classifier',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const classifyResource = api.root.addResource('classify');
    classifyResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(proxyFn, { proxy: true })
    );

    // -----------------------------------------------------------------------
    // Stack Outputs — emitted to the CloudFormation console and to the CDK
    // CLI so that downstream systems (CI, Terraform, scripts) can resolve
    // resource identifiers without hard-coding ARNs or names.
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, 'ModelBucketName', {
      exportName: 'OvernighterModelBucketName',
      value: mlBucket.bucketName,
      description: 'S3 bucket holding ML training data and model artefacts',
    });

    new cdk.CfnOutput(this, 'SageMakerEndpointName', {
      exportName: 'OvernighterSageMakerEndpointName',
      value: cfnEndpoint.ref,
      description: 'Name of the live SageMaker inference endpoint',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      exportName: 'OvernighterApiGatewayUrl',
      value: `${api.url}classify`,
      description: 'Public URL for the /classify endpoint',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      exportName: 'OvernighterEcrRepositoryUri',
      value: ecrRepo.repositoryUri,
      description: 'ECR repository URI for the inference container image',
    });
  }
}
