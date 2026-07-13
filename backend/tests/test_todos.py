import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_todo(client: AsyncClient):
    response = await client.post("/todos", json={"title": "Test Task", "done": False})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Task"
    assert data["done"] is False
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_todo_invalid_title(client: AsyncClient):
    # Empty title should fail with 422
    response = await client.post("/todos", json={"title": "", "done": False})
    assert response.status_code == 422


async def test_get_todos(client: AsyncClient):
    # Initially empty
    response = await client.get("/todos")
    assert response.status_code == 200
    assert response.json() == []

    # Create one
    await client.post("/todos", json={"title": "Task 1"})

    # Get list
    response = await client.get("/todos")
    assert response.status_code == 200
    todos = response.json()
    assert len(todos) == 1
    assert todos[0]["title"] == "Task 1"


async def test_get_todo_by_id(client: AsyncClient):
    create_response = await client.post("/todos", json={"title": "Task 2"})
    todo_id = create_response.json()["id"]

    response = await client.get(f"/todos/{todo_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Task 2"


async def test_get_todo_not_found(client: AsyncClient):
    random_id = str(uuid.uuid4())
    response = await client.get(f"/todos/{random_id}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


async def test_update_todo(client: AsyncClient):
    create_response = await client.post("/todos", json={"title": "Task 3", "done": False})
    todo_id = create_response.json()["id"]

    # Update only the done status
    response = await client.put(f"/todos/{todo_id}", json={"done": True})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Task 3"
    assert data["done"] is True

    # Update title
    response = await client.put(f"/todos/{todo_id}", json={"title": "Updated Task 3"})
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Task 3"


async def test_delete_todo(client: AsyncClient):
    create_response = await client.post("/todos", json={"title": "Task to Delete"})
    todo_id = create_response.json()["id"]

    # Delete
    response = await client.delete(f"/todos/{todo_id}")
    assert response.status_code == 200
    assert response.json() == {"message": f"Todo {todo_id} deleted successfully"}

    # Verify deleted
    verify_response = await client.get(f"/todos/{todo_id}")
    assert verify_response.status_code == 404
