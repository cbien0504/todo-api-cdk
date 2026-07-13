import os
from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    Duration,
    BundlingOptions,
    aws_ec2 as ec2,
    aws_rds as rds,
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

        # 1. Network: NAT-less VPC (2 Public subnets, 2 Isolated subnets)
        vpc = ec2.Vpc(
            self, "TodoVpc",
            max_azs=2,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24
                ),
                ec2.SubnetConfiguration(
                    name="Isolated",
                    subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24
                )
            ]
        )

        # 2. Database: PostgreSQL RDS instance with Graviton instance
        db_security_group = ec2.SecurityGroup(
            self, "DBSecurityGroup",
            vpc=vpc,
            description="Allow connection on PostgreSQL port 5432",
            allow_all_outbound=True
        )

        db_instance = rds.DatabaseInstance(
            self, "TodoDatabase",
            engine=rds.DatabaseInstanceEngine.postgres(version=rds.PostgresEngineVersion.VER_16),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE4_GRAVITON, 
                ec2.InstanceSize.MICRO
            ),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[db_security_group],
            database_name="todo_db",
            removal_policy=RemovalPolicy.DESTROY,
            deletion_protection=False
        )

        # 3. Security Group for Lambda Function
        lambda_security_group = ec2.SecurityGroup(
            self, "LambdaSecurityGroup",
            vpc=vpc,
            description="Security Group for Lambda running FastAPI",
            allow_all_outbound=True
        )

        # Allow Lambda SG to connect to RDS PostgreSQL SG on port 5432
        db_security_group.connections.allow_from(
            lambda_security_group,
            ec2.Port.tcp(5432),
            "Allow traffic from Lambda function to RDS"
        )

        # 4. Lambda: Python 3.12 Function to run FastAPI via Mangum
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
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[lambda_security_group],
            environment={
                "POSTGRES_HOST": db_instance.db_instance_endpoint_address,
                "POSTGRES_PORT": "5432",
                "POSTGRES_USER": "postgres",
                "POSTGRES_DB": "todo_db",
                "POSTGRES_PASSWORD": db_instance.secret.secret_value_from_json("password").unsafe_unwrap()
            },
            timeout=Duration.seconds(30),
            memory_size=512
        )

        # Grant Lambda permissions to read the RDS secret if needed
        db_instance.secret.grant_read(todo_lambda)

        # 5. API Gateway: REST API proxy with Auto CORS
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

        # 6. Frontend: Private S3 Bucket for static files
        frontend_bucket = s3.Bucket(
            self, "FrontendBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            encryption=s3.BucketEncryption.S3_MANAGED
        )

        # 7. CloudFront: Default serves S3 frontend, other routes proxy REST API Gateway
        # Configure error responses to support client-side routing for SPA
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
            # Route API paths to API Gateway
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
