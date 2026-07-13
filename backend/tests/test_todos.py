import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_todo(client: AsyncClient):
    response = await client.post("/todos", json={"title": "Test Task", "done": False})
    assert response.status_code == 201
    res = response.json()
    assert "data" in res
    data = res["data"]
    assert data["title"] == "Test Task"
    assert data["done"] is False
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_todo_invalid_title(client: AsyncClient):
    response = await client.post("/todos", json={"title": "", "done": False})
    assert response.status_code == 422
    res = response.json()
    assert "error" in res
    assert res["error"]["code"] == "VALIDATION_ERROR"
    assert "title" in res["error"]["message"]


async def test_create_todo_extra_fields(client: AsyncClient):
    response = await client.post("/todos", json={"title": "Task", "done": False, "extra_field": "forbidden"})
    assert response.status_code == 422
    res = response.json()
    assert "error" in res
    assert res["error"]["code"] == "VALIDATION_ERROR"
    assert "extra_field" in res["error"]["message"]


async def test_get_todos(client: AsyncClient):
    response = await client.get("/todos")
    assert response.status_code == 200
    res = response.json()
    assert len(res["data"]) == 0
    assert "meta" in res

    await client.post("/todos", json={"title": "Task 1"})

    response = await client.get("/todos")
    assert response.status_code == 200
    res = response.json()
    todos = res["data"]
    assert len(todos) == 1
    assert todos[0]["title"] == "Task 1"


async def test_get_todo_by_id(client: AsyncClient):
    create_response = await client.post("/todos", json={"title": "Task 2"})
    todo_id = create_response.json()["data"]["id"]

    response = await client.get(f"/todos/{todo_id}")
    assert response.status_code == 200
    res = response.json()
    assert res["data"]["title"] == "Task 2"


async def test_get_todo_not_found(client: AsyncClient):
    random_id = str(uuid.uuid4())
    response = await client.get(f"/todos/{random_id}")
    assert response.status_code == 404
    res = response.json()
    assert "error" in res
    assert res["error"]["code"] == "NOT_FOUND"


async def test_update_todo(client: AsyncClient):
    create_response = await client.post("/todos", json={"title": "Task 3", "done": False})
    todo_id = create_response.json()["data"]["id"]

    response = await client.put(f"/todos/{todo_id}", json={"done": True})
    assert response.status_code == 200
    res = response.json()
    data = res["data"]
    assert data["title"] == "Task 3"
    assert data["done"] is True

    response = await client.put(f"/todos/{todo_id}", json={"title": "Updated Task 3"})
    assert response.status_code == 200
    res = response.json()
    assert res["data"]["title"] == "Updated Task 3"


async def test_delete_todo(client: AsyncClient):
    create_response = await client.post("/todos", json={"title": "Task to Delete"})
    todo_id = create_response.json()["data"]["id"]

    response = await client.delete(f"/todos/{todo_id}")
    assert response.status_code == 200
    res = response.json()
    assert res["data"]["message"] == f"Todo {todo_id} deleted successfully"

    verify_response = await client.get(f"/todos/{todo_id}")
    assert verify_response.status_code == 404
