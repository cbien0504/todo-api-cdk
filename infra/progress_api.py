from aws_cdk import (
    Duration,
    RemovalPolicy,
    Stack,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as integrations,
    aws_dynamodb as dynamodb,
    aws_lambda as _lambda,
    aws_logs as logs,
)
from constructs import Construct

BACKEND_DIR = "backend"


class ProgressApi(Construct):
    """The learners' accounts and progress: a DynamoDB table used by a Lambda behind an HTTP API (backend/)."""

    def __init__(self, scope: Construct, construct_id: str) -> None:
        super().__init__(scope, construct_id)

        self.table = dynamodb.Table(
            self,
            "Table",
            partition_key=dynamodb.Attribute(name="username", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="record", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            # Login sessions are deleted once expired.
            time_to_live_attribute="expiresAt",
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            # The progress of the learners cannot be rebuilt: the table stays if the stack is deleted.
            removal_policy=RemovalPolicy.RETAIN,
        )

        function = _lambda.Function(
            self,
            "Function",
            runtime=_lambda.Runtime.PYTHON_3_12,
            architecture=_lambda.Architecture.ARM_64,
            handler="handler.handler",
            # Standard library and the boto3 of the runtime only: nothing to bundle.
            code=_lambda.Code.from_asset(
                BACKEND_DIR,
                exclude=["tests", "dev_server.py", "reset_password.py", "requirements-dev.txt", "**/__pycache__"],
            ),
            environment={"TABLE_NAME": self.table.table_name},
            # CPU grows with memory: hashing a password (scrypt) takes ~0.3 s.
            memory_size=512,
            timeout=Duration.seconds(10),
            log_group=logs.LogGroup(
                self, "Logs", retention=logs.RetentionDays.ONE_MONTH, removal_policy=RemovalPolicy.DESTROY
            ),
        )
        self.table.grant_read_write_data(function)

        http_api = apigwv2.HttpApi(self, "HttpApi", create_default_stage=False)
        apigwv2.HttpStage(
            self,
            "Stage",
            http_api=http_api,
            auto_deploy=True,
            # For all learners together: ~1000 learners syncing every 10 s stay well below.
            throttle=apigwv2.ThrottleSettings(rate_limit=100, burst_limit=200),
        )
        integration = integrations.HttpLambdaIntegration("Integration", function)
        for path, method in [
            ("/api/register", apigwv2.HttpMethod.POST),
            ("/api/login", apigwv2.HttpMethod.POST),
            ("/api/logout", apigwv2.HttpMethod.POST),
            ("/api/users/{username}/progress", apigwv2.HttpMethod.GET),
            ("/api/users/{username}/progress/{deck}", apigwv2.HttpMethod.PATCH),
        ]:
            http_api.add_routes(path=path, methods=[method], integration=integration)

        # Host of the API, used as the CloudFront origin of /api/*.
        stack = Stack.of(self)
        self.domain_name = f"{http_api.api_id}.execute-api.{stack.region}.{stack.url_suffix}"
