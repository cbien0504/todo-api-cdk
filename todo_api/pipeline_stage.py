from aws_cdk import Stage
from constructs import Construct
from todo_api.todo_api_stack import TodoApiStack

class TodoApiStage(Stage):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        TodoApiStack(self, "TodoApiStack")
