import os
from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    Duration,
    BundlingOptions,
    aws_dynamodb as dynamodb,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3_deployment as s3_deployment,
)
from constructs import Construct


class TodoApiStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # 1. Database: DynamoDB Table (AWS Free Tier compliant)
        todo_table = dynamodb.Table(
            self, "TodoTable",
            partition_key=dynamodb.Attribute(
                name="id",
                type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # 2. Global Secondary Index (GSI) for pagination and sorting
        todo_table.add_global_secondary_index(
            index_name="CreatedAtIndex",
            partition_key=dynamodb.Attribute(
                name="type",
                type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="created_at",
                type=dynamodb.AttributeType.STRING
            ),
            projection_type=dynamodb.ProjectionType.ALL
        )

        # 3. Lambda: Python 3.12 Function to run FastAPI via Mangum
        todo_lambda = _lambda.Function(
            self, "TodoHandler",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="app.main.handler",
            code=_lambda.Code.from_asset(
                path="backend",
                bundling=BundlingOptions(
                    image=_lambda.Runtime.PYTHON_3_12.bundling_image,
                    command=[
                        "bash", "-c",
                        "pip install --no-cache-dir -r requirements.txt -t /asset-output && cp -R . /asset-output"
                    ]
                )
            ),
            environment={
                "TODOS_TABLE_NAME": todo_table.table_name,
            },
            timeout=Duration.seconds(30),
            memory_size=512
        )

        # Grant Lambda read/write access to DynamoDB Table
        todo_table.grant_read_write_data(todo_lambda)

        # 4. API Gateway: REST API proxy with Auto CORS
        todo_api = apigateway.LambdaRestApi(
            self, "TodoApi",
            handler=todo_lambda,
            proxy=True,
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS
            )
        )

        CfnOutput(
            self, "ApiEndpoint",
            value=todo_api.url,
            description="The URL of the Todo REST API"
        )

        # 5. Frontend: Private S3 Bucket for static files
        frontend_bucket = s3.Bucket(
            self, "FrontendBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            encryption=s3.BucketEncryption.S3_MANAGED
        )

        # 6. CloudFront: Default serves S3 frontend, other routes proxy REST API Gateway
        error_responses = [
            cloudfront.ErrorResponse(
                http_status=403,
                response_http_status=200,
                response_page_path="/index.html",
                ttl=Duration.seconds(0)
            ),
            cloudfront.ErrorResponse(
                http_status=404,
                response_http_status=200,
                response_page_path="/index.html",
                ttl=Duration.seconds(0)
            )
        ]

        distribution = cloudfront.Distribution(
            self, "FrontendDistribution",
            default_root_object="index.html",
            error_responses=error_responses,
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(frontend_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            ),
            additional_behaviors={
                "todos": cloudfront.BehaviorOptions(
                    origin=origins.RestApiOrigin(todo_api),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED
                ),
                "todos/*": cloudfront.BehaviorOptions(
                    origin=origins.RestApiOrigin(todo_api),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED
                ),
                "health": cloudfront.BehaviorOptions(
                    origin=origins.RestApiOrigin(todo_api),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED
                )
            }
        )


        # Fallback to frontend root dir for synthesis if vite build dist hasn't run yet
        frontend_asset_dir = "frontend/dist" if os.path.exists("frontend/dist") else "frontend"

        s3_deployment.BucketDeployment(
            self, "DeployFrontend",
            sources=[s3_deployment.Source.asset(frontend_asset_dir)],
            destination_bucket=frontend_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        CfnOutput(
            self, "FrontendUrl",
            value=f"https://{distribution.distribution_domain_name}",
            description="URL của frontend (CloudFront)"
        )
