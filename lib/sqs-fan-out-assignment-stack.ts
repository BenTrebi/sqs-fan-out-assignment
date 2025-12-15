import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export class SqsFanOutAssignmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Input Bucket
    const inputBucket = new s3.Bucket(this, 'InputBucket', {
      bucketName: `image-input-bucket-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, 
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    //Output Bucket
    const outputBucket = new s3.Bucket(this, 'OutputBucket', {
      bucketName: `image-input-bucket-${cdk.Aws.ACCOUNT_ID}-resized`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    //SNS Topic
    const imageTopic = new sns.Topic(this, 'ImageProcessingTopic', {
      displayName: 'Image Processing Topic',
      topicName: 'image-processing-topic',
    });

    //SQS Queue
    const imageQueue = new sqs.Queue(this, 'ImageProcessingQueue', {
      queueName: 'image-processing-queue',
      visibilityTimeout: cdk.Duration.seconds(300), 
      retentionPeriod: cdk.Duration.days(4),
    });

    //Subscribe SQS to SNS
    imageTopic.addSubscription(new subscriptions.SqsSubscription(imageQueue));

    //S3 Event Notifications
    // For .jpg files
    inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(imageTopic),
      { suffix: '.jpg' }
    );

    // For .jpeg files
    inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(imageTopic),
      { suffix: '.jpeg' }
    );

    // For .png files
    inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(imageTopic),
      { suffix: '.png' }
    );


    //Lambda Function
    const imageProcessorFunction = new lambda.Function(this, 'ImageProcessorFunction', {
      functionName: 'image-processor',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda_function.lambda_handler', 
      code: lambda.Code.fromAsset('lambda'), 
      timeout: cdk.Duration.seconds(300), 
      memorySize: 512, 
      environment: {
        INPUT_BUCKET: inputBucket.bucketName,
        OUTPUT_BUCKET: outputBucket.bucketName,
        VERSION: '2',
      },
      description: 'Processes uploaded images and creates 128x128 thumbnails',
    });



    const pillowLayer = new lambda.LayerVersion(this, 'PillowLayer', {
      code: lambda.Code.fromAsset('lambda-layer'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      description: 'Pillow (PIL) for image processing',
    });

    imageProcessorFunction.addLayers(pillowLayer);

    //Lambda Permissions
    inputBucket.grantRead(imageProcessorFunction);

    outputBucket.grantWrite(imageProcessorFunction);

    //SQS Trigger Lambda
    imageProcessorFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(imageQueue, {
        batchSize: 10, 
        maxBatchingWindow: cdk.Duration.seconds(5), 
        reportBatchItemFailures: true, 
      })
    );

    //Stack Outputs
    new cdk.CfnOutput(this, 'InputBucketName', {
      value: inputBucket.bucketName,
      description: 'S3 bucket for uploading images',
      exportName: 'ImageInputBucket',
    });

    new cdk.CfnOutput(this, 'OutputBucketName', {
      value: outputBucket.bucketName,
      description: 'S3 bucket where resized images will be stored',
      exportName: 'ImageOutputBucket',
    });

    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: imageTopic.topicArn,
      description: 'SNS Topic ARN for image processing events',
    });

    new cdk.CfnOutput(this, 'SQSQueueUrl', {
      value: imageQueue.queueUrl,
      description: 'SQS Queue URL for image processing',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: imageProcessorFunction.functionName,
      description: 'Lambda function name for image processing',
    });
  }
}
