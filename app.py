import os
import aws_cdk as cdk
from todo_api.todo_api_stack import TodoApiStack
from todo_api.pipeline_stack import PipelineStack

app = cdk.App()

TodoApiStack(
    app, 
    "TodoApiStack",
    env=cdk.Environment(
        account="772908588074",
        region="ap-southeast-1",
    ),
)

PipelineStack(
    app,
    "PipelineStack",
    env=cdk.Environment(
        account="772908588074",
        region="ap-southeast-1",
    ),
)

app.synth()
