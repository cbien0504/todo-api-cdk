import axios from "axios";
import type { Todo, TodoCreate, TodoUpdate } from "../types/todo";

export const getApiBaseUrl = (): string => {
  const customUrl = localStorage.getItem("todo_api_url");
  if (customUrl) {
    return customUrl.endsWith("/") ? customUrl : `${customUrl}/`;
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL || "/";
  return envUrl.endsWith("/") ? envUrl : `${envUrl}/`;
};

const getClient = () => {
  return axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const todoApi = {
  getTodos: async (): Promise<Todo[]> => {
    const client = getClient();
    const response = await client.get<Todo[]>("todos");
    return response.data;
  },

  createTodo: async (todo: TodoCreate): Promise<Todo> => {
    const client = getClient();
    const response = await client.post<Todo>("todos", todo);
    return response.data;
  },

  updateTodo: async (id: string, todo: TodoUpdate): Promise<Todo> => {
    const client = getClient();
    const response = await client.put<Todo>(`todos/${id}`, todo);
    return response.data;
  },

  deleteTodo: async (id: string): Promise<{ message: string }> => {
    const client = getClient();
    const response = await client.delete<{ message: string }>(`todos/${id}`);
    return response.data;
  },
};
