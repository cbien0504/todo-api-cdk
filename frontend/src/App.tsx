import React, { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { todoApi, getApiBaseUrl } from "./api/todoApi";
import type { Todo } from "./types/todo";

// Initialize Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface ToastMessage {
  id: string;
  text: string;
  icon: string;
}

function MainApp() {
  const queryClient = useQueryClient();
  const [activeUrl, setActiveUrl] = useState<string>(getApiBaseUrl());
  const [inputUrl, setInputUrl] = useState<string>(getApiBaseUrl());
  const [newTitle, setNewTitle] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Show a notifications toast helper
  const showToast = (text: string, icon = "ℹ️") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Queries
  const {
    data: todos = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Todo[]>({
    queryKey: ["todos", activeUrl],
    queryFn: todoApi.getTodos,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: todoApi.createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      setNewTitle("");
      showToast("Task added successfully", "✅");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.detail || "Failed to create task", "❌");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title, done }: { id: string; title?: string; done?: boolean }) =>
      todoApi.updateTodo(id, { title, done }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      showToast(data.done ? "Task completed!" : "Task active", "✓");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.detail || "Failed to update task", "❌");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: todoApi.deleteTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      showToast("Task deleted", "🗑️");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.detail || "Failed to delete task", "❌");
    },
  });

  // Handlers
  const handleSaveConfig = () => {
    let url = inputUrl.trim();
    if (!url) {
      showToast("API URL cannot be empty", "⚠️");
      return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://") && url !== "/") {
      showToast("URL must start with http:// or https://", "⚠️");
      return;
    }
    if (url !== "/" && !url.endsWith("/")) {
      url += "/";
    }
    localStorage.setItem("todo_api_url", url);
    setActiveUrl(url);
    showToast("Endpoint configuration saved!", "✅");
  };

  const handleResetConfig = () => {
    localStorage.removeItem("todo_api_url");
    const defaultUrl = import.meta.env.VITE_API_BASE_URL || "/";
    setActiveUrl(defaultUrl);
    setInputUrl(defaultUrl);
    showToast("Reset to default endpoint", "🔄");
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    createMutation.mutate({ title, done: false });
  };

  const handleToggleTodo = (todo: Todo) => {
    updateMutation.mutate({ id: todo.id, done: !todo.done });
  };

  const handleStartEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  };

  const handleSaveEdit = (id: string) => {
    const title = editingTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    updateMutation.mutate({ id, title });
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteMutation.mutate(id);
    }
  };

  // Determine Connection Status
  const isConnected = !isError && !isLoading;
  const statusBadgeText = isLoading || isFetching ? "Syncing..." : isConnected ? "Connected" : "Error";

  return (
    <>
      <header>
        <h1>Todo Cloud Manager</h1>
        <p className="subtitle">React Vite + TypeScript Frontend connected to FastAPI & PostgreSQL</p>
      </header>

      {/* Network Configuration card */}
      <section className="card config-section">
        <div className="config-title">API Endpoint Connection</div>
        <div className="input-group">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Connection URL, e.g. http://localhost:8000"
          />
          <button className="btn-primary" onClick={handleSaveConfig}>
            Connect
          </button>
          <button className="btn-secondary" onClick={handleResetConfig}>
            Reset
          </button>
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            Active Endpoint:{" "}
            <strong style={{ color: "#6366f1", wordBreak: "break-all" }}>
              {activeUrl}
            </strong>
          </span>
          <span
            className="badge"
            style={{
              background: isLoading || isFetching
                ? "rgba(255, 255, 255, 0.05)"
                : isConnected
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
              color: isLoading || isFetching
                ? "var(--text-secondary)"
                : isConnected
                ? "var(--accent-green)"
                : "var(--accent-red)",
            }}
          >
            {statusBadgeText}
          </span>
        </div>
      </section>

      {/* Add Task card */}
      <section className="card">
        <form className="todo-form" onSubmit={handleAddTodo}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Type a task and press enter..."
            disabled={!isConnected || createMutation.isPending}
            required
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!isConnected || !newTitle.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <div className="spinner"></div> Creating...
              </>
            ) : (
              "Add Task"
            )}
          </button>
        </form>
      </section>

      {/* Task List card */}
      <section className="card todo-list-container">
        <div className="todo-list-header">
          <h3>My Tasks</h3>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {todos.length} task{todos.length === 1 ? "" : "s"}
          </span>
        </div>

        <ul className="todo-list">
          {isLoading ? (
            <div className="empty-state">
              <div className="spinner"></div>
              <p style={{ marginTop: "0.5rem" }}>Loading tasks from FastAPI...</p>
            </div>
          ) : isError ? (
            <div className="empty-state">
              <p style={{ color: "var(--accent-red)", fontWeight: 500 }}>
                Failed to connect to API Backend
              </p>
              <p style={{ fontSize: "0.8rem", maxWidth: "80%" }}>
                {(error as Error)?.message}
              </p>
              <button
                className="btn-secondary"
                onClick={() => refetch()}
                style={{ marginTop: "0.5rem", padding: "0.4rem 1rem" }}
              >
                Retry
              </button>
            </div>
          ) : todos.length === 0 ? (
            <div className="empty-state">
              <p>No tasks yet. Create one above!</p>
            </div>
          ) : (
            todos.map((todo) => (
              <li
                key={todo.id}
                className={`todo-item ${todo.done ? "completed" : ""}`}
              >
                <div className="todo-item-left">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => handleToggleTodo(todo)}
                      disabled={updateMutation.isPending}
                    />
                    <span className="checkmark"></span>
                  </label>
                  <div className="todo-text-wrapper">
                    {editingId === todo.id ? (
                      <input
                        type="text"
                        className="todo-edit-input"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveEdit(todo.id)}
                        onKeyDown={(e) => handleKeyDown(e, todo.id)}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="todo-text"
                        onClick={() => handleStartEdit(todo)}
                        title="Click to edit task title"
                      >
                        {todo.title}
                      </span>
                    )}
                  </div>
                </div>

                <div className="todo-actions">
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleDelete(todo.id)}
                    disabled={deleteMutation.isPending}
                    title="Delete Task"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Floating Notifications Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.icon}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  );
}
