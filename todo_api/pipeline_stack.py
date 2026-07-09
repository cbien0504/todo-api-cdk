import aws_cdk as cdk
from aws_cdk import (
    Stack,
    pipelines,
)
from constructs import Construct
from todo_api.pipeline_stage import TodoApiStage

class PipelineStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        connection_arn = self.node.try_get_context("github_connection_arn")
        if not connection_arn:
            raise ValueError(
                "github_connection_arn context variable is not set. Please create a GitHub Connection "
                "via AWS Developer Tools Console and set context github_connection_arn in cdk.json "
                "or pass it via --context github_connection_arn=<ARN>."
            )

        pipeline = pipelines.CodePipeline(
            self, "Pipeline",
            pipeline_name="TodoApiPipeline",
            synth=pipelines.ShellStep(
                "Synth",
                input=pipelines.CodePipelineSource.connection(
                    "cbien0504/todo-api-cdk",
                    "main",
                    connection_arn=connection_arn
                ),
                commands=[
                    "pip install -r requirements.txt",
                    "npm install -g aws-cdk",
                    "cdk synth"
                ]
            )
        )

        deploy_stage = TodoApiStage(
            self, "Deploy",
            env=cdk.Environment(
                account="772908588074",
                region="ap-southeast-1"
            )
        )
        pipeline.add_stage(deploy_stage)
