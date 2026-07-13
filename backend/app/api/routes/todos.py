import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.todo import Todo as TodoModel
from app.schemas.todo import Todo, TodoCreate, TodoUpdate

router = APIRouter()


@router.get("", response_model=List[Todo])
async def read_todos(
    db: AsyncSession = Depends(get_db),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
):
    """
    Retrieve todos with basic offset/limit pagination.
    """
    stmt = select(TodoModel).order_by(TodoModel.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    todos = result.scalars().all()
    return todos


@router.post("", response_model=Todo, status_code=status.HTTP_201_CREATED)
async def create_todo(
    todo_in: TodoCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new todo.
    """
    db_obj = TodoModel(
        title=todo_in.title,
        done=todo_in.done,
    )
    db.add(db_obj)
    await db.flush()  # Populates db_obj.id, created_at, updated_at
    await db.refresh(db_obj)
    return db_obj


@router.get("/{id}", response_model=Todo)
async def read_todo(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a todo by ID.
    """
    db_obj = await db.get(TodoModel, id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id {id} not found",
        )
    return db_obj


@router.put("/{id}", response_model=Todo)
async def update_todo(
    id: uuid.UUID,
    todo_in: TodoUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update a todo.
    """
    db_obj = await db.get(TodoModel, id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id {id} not found",
        )

    update_data = todo_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)

    db.add(db_obj)
    await db.flush()
    await db.refresh(db_obj)
    return db_obj


@router.delete("/{id}")
async def delete_todo(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a todo.
    """
    db_obj = await db.get(TodoModel, id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id {id} not found",
        )

    await db.delete(db_obj)
    return {"message": f"Todo {id} deleted successfully"}
