import os

from aws_cdk import (
    CfnOutput,
    Duration,
    RemovalPolicy,
    Stack,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3 as s3,
    aws_s3_deployment as s3_deployment,
)
from constructs import Construct

from infra.progress_api import ProgressApi

FRONTEND_DIST = "frontend/dist"


class StudyAppStack(Stack):
    """The study app: its built files in a private S3 bucket (Origin Access Control) and the
    progress API at /api/*, both served by one CloudFront distribution."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        if not os.path.isdir(FRONTEND_DIST):
            raise FileNotFoundError(f"{FRONTEND_DIST} not found: run `npm run build --prefix frontend` first")

        bucket = s3.Bucket(
            self,
            "FrontendBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
        )

        api = ProgressApi(self, "ProgressApi")

        # Single-page app: paths that are not files serve index.html. This applies to every origin,
        # so the API never answers 403 or 404.
        error_responses = [
            cloudfront.ErrorResponse(
                http_status=http_status,
                response_http_status=200,
                response_page_path="/index.html",
                ttl=Duration.seconds(0),
            )
            for http_status in (403, 404)
        ]

        distribution = cloudfront.Distribution(
            self,
            "FrontendDistribution",
            default_root_object="index.html",
            error_responses=error_responses,
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            ),
            # Same origin as the app: no CORS.
            additional_behaviors={
                "/api/*": cloudfront.BehaviorOptions(
                    origin=origins.HttpOrigin(api.domain_name),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                    origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                )
            },
        )

        s3_deployment.BucketDeployment(
            self,
            "DeployFrontend",
            sources=[s3_deployment.Source.asset(FRONTEND_DIST)],
            destination_bucket=bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        CfnOutput(
            self,
            "FrontendUrl",
            value=f"https://{distribution.distribution_domain_name}",
            description="URL của frontend (CloudFront)",
        )
        CfnOutput(
            self,
            "ProgressTableName",
            value=api.table.table_name,
            description="Bảng DynamoDB chứa tiến độ của từng người học",
        )
