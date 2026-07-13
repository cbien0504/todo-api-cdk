import asyncio
from typing import AsyncGenerator
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

class MockTable:
    def __init__(self):
        self.items = {}
        
    def put_item(self, Item):
        self.items[Item["id"]] = Item
        return {}
        
    def get_item(self, Key):
        item_id = Key.get("id")
        item = self.items.get(item_id)
        if item:
            return {"Item": item}
        return {}
        
    def delete_item(self, Key):
        item_id = Key.get("id")
        self.items.pop(item_id, None)
        return {}
        
    def query(self, **kwargs):
        res = list(self.items.values())
        res = [i for i in res if i.get("type", "todo") == "todo"]
        
        # simulated filter
        if "FilterExpression" in kwargs:
            filter_expr = kwargs["FilterExpression"]
            val = getattr(filter_expr, "value", None)
            if val is not None:
                res = [i for i in res if i.get("done") == val]

        # sort order
        forward = kwargs.get("ScanIndexForward", True)
        res.sort(key=lambda x: x.get("created_at", ""), reverse=not forward)
        
        limit = kwargs.get("Limit", 10)
        items_page = res[:limit]
        
        last_key = None
        if len(res) > limit:
            last_key = {
                "id": items_page[-1]["id"],
                "type": "todo",
                "created_at": items_page[-1]["created_at"]
            }
            
        return {
            "Items": items_page,
            "LastEvaluatedKey": last_key
        }
        
    def scan(self, **kwargs):
        res = list(self.items.values())
        if "FilterExpression" in kwargs:
            filter_expr = kwargs["FilterExpression"]
            val = getattr(filter_expr, "value", None)
            if val is not None:
                res = [i for i in res if i.get("done") == val]
        return {"Items": res}

@pytest.fixture(scope="function", autouse=True)
def mock_db_table(monkeypatch):
    """
    Mock the boto3 DynamoDB Table workspace object to isolate database state.
    """
    mock_table = MockTable()
    monkeypatch.setattr("app.api.routes.todos.get_table", lambda: mock_table)
    return mock_table

@pytest.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac
