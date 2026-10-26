import aws_cdk as cdk

from infra.study_app_stack import StudyAppStack

app = cdk.App()

# The stack keeps its original CloudFormation name so deployments update it in place:
# a new name would create a second stack, with a new CloudFront domain.
StudyAppStack(
    app,
    "TodoApiStack",
    env=cdk.Environment(
        account="772908588074",
        region="ap-southeast-1",
    ),
)

app.synth()
