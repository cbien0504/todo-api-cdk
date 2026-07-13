from typing import Generic, TypeVar, List
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar('T')

class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="The title of the todo item")
    done: bool = Field(default=False, description="Whether the total item is completed")

    model_config = ConfigDict(extra="forbid")


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255, description="The updated title of the todo item")
    done: bool | None = Field(default=None, description="Whether the todo item is completed")

    model_config = ConfigDict(extra="forbid")


class Todo(BaseModel):
    id: str
    title: str
    done: bool
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class SingleResponse(BaseModel, Generic[T]):
    data: T


class MetaInfo(BaseModel):
    next_token: str | None = None


class ListResponse(BaseModel, Generic[T]):
    data: List[T]
    meta: MetaInfo


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
