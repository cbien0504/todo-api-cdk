import base64
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, status
from boto3.dynamodb.conditions import Key, Attr
from app.db.session import get_table
from app.schemas.todo import Todo, TodoCreate, TodoUpdate, SingleResponse, ListResponse, MetaInfo

router = APIRouter()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def encode_token(key_dict: dict | None) -> str | None:
    if not key_dict:
        return None
    try:
        json_str = json.dumps(key_dict)
        return base64.urlsafe_b64encode(json_str.encode("utf-8")).decode("utf-8")
    except Exception:
        return None


def decode_token(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        decoded_bytes = base64.urlsafe_b64decode(token.encode("utf-8"))
        return json.loads(decoded_bytes.decode("utf-8"))
    except Exception:
        return None


def get_todo_or_404(table, id: str) -> dict:
    item = table.get_item(Key={"id": id}).get("Item")
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id {id} not found",
        )
    return item


@router.get("", response_model=ListResponse[Todo])
async def read_todos(
    done: bool | None = Query(default=None),
    sort: str = Query(default="-created_at"),
    limit: int = Query(default=10, ge=1, le=100),
    next_token: str | None = Query(default=None),
):
    """
    Retrieve todos from DynamoDB using a global secondary index (CreatedAtIndex)
    to support pagination and sorting.
    """
    table = get_table()
    ascending = sort == "created_at"

    page_kwargs = {"Limit": limit}
    if done is not None:
        page_kwargs["FilterExpression"] = Attr("done").eq(done)
    start_key = decode_token(next_token)
    if start_key:
        page_kwargs["ExclusiveStartKey"] = start_key

    try:
        response = table.query(
            IndexName="CreatedAtIndex",
            KeyConditionExpression=Key("type").eq("todo"),
            ScanIndexForward=ascending,
            **page_kwargs,
        )
        items = response.get("Items", [])
    except Exception:
        # Fallback to scan if GSI has not finished creating or fails in local environments
        response = table.scan(**page_kwargs)
        items = sorted(response.get("Items", []), key=lambda x: x.get("created_at", ""), reverse=not ascending)

    return ListResponse(
        data=items,
        meta=MetaInfo(next_token=encode_token(response.get("LastEvaluatedKey"))),
    )


@router.post("", response_model=SingleResponse[Todo], status_code=status.HTTP_201_CREATED)
async def create_todo(todo_in: TodoCreate):
    """
    Create a new todo in DynamoDB.
    """
    now_iso = utc_now_iso()
    item = {
        "id": str(uuid.uuid4()),
        "type": "todo",
        "title": todo_in.title,
        "done": todo_in.done,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    get_table().put_item(Item=item)
    return SingleResponse(data=item)


@router.get("/{id}", response_model=SingleResponse[Todo])
async def read_todo(id: str):
    """
    Get a single todo.
    """
    return SingleResponse(data=get_todo_or_404(get_table(), id))


@router.put("/{id}", response_model=SingleResponse[Todo])
async def update_todo(id: str, todo_in: TodoUpdate):
    """
    Update an existing todo.
    """
    table = get_table()
    item = get_todo_or_404(table, id)

    update_data = todo_in.model_dump(exclude_unset=True)
    if not update_data:
        return SingleResponse(data=item)

    item.update(update_data)
    item["updated_at"] = utc_now_iso()
    table.put_item(Item=item)
    return SingleResponse(data=item)


@router.delete("/{id}")
async def delete_todo(id: str):
    """
    Delete a todo.
    """
    table = get_table()
    get_todo_or_404(table, id)
    table.delete_item(Key={"id": id})
    return {"data": {"message": f"Todo {id} deleted successfully"}}
