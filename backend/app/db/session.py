import boto3
from app.core.config import settings

def get_table():
    if settings.DYNAMODB_ENDPOINT_URL:
        db = boto3.resource("dynamodb", endpoint_url=settings.DYNAMODB_ENDPOINT_URL)
    else:
        db = boto3.resource("dynamodb")
    return db.Table(settings.TODOS_TABLE_NAME)
