import aws_cdk as cdk
from todo_api.todo_api_stack import TodoApiStack

app = cdk.App()

TodoApiStack(
    app,
    "TodoApiStack",
    env=cdk.Environment(
        account="772908588074",
        region="ap-southeast-1",
    ),
)

app.synth()
