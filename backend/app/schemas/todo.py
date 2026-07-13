import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="The title of the todo item")
    done: bool = Field(default=False, description="Whether the todo item is completed")


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255, description="The updated title of the todo item")
    done: bool | None = Field(default=None, description="Whether the todo item is completed")


class TodoInDBBase(BaseModel):
    id: uuid.UUID
    title: str
    done: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Todo(TodoInDBBase):
    pass
