import React, { useState, useEffect } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { todoApi, getApiBaseUrl, type FetchTodosResponse } from "./api/todoApi";
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

  // Search/Filters/Sort states
  const [filterTab, setFilterTab] = useState<"all" | "active" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"-created_at" | "created_at">("-created_at");

  // Dark/Light mode state
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Show a notifications toast helper
  const showToast = (text: string, icon = "ℹ️") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Queries (Restructured to follow pagination & filtering schemas)
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<FetchTodosResponse>({
    queryKey: ["todos", activeUrl, filterTab, sortOrder],
    queryFn: () =>
      todoApi.getTodos({
        done: filterTab === "all" ? undefined : filterTab === "completed",
        sort: sortOrder,
      }),
  });

  const todos = data?.data || [];

  // Mutations with Optimistic UI updates
  const createMutation = useMutation({
    mutationFn: todoApi.createTodo,
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previousData = queryClient.getQueryData<FetchTodosResponse>([
        "todos",
        activeUrl,
        filterTab,
        sortOrder,
      ]);

      const optimisticTodo: Todo = {
        id: `optimistic-${Date.now()}`,
        title: newTodo.title,
        done: newTodo.done || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (previousData) {
        queryClient.setQueryData(["todos", activeUrl, filterTab, sortOrder], {
          ...previousData,
          data: [optimisticTodo, ...previousData.data],
        });
      }

      return { previousData };
    },
    onError: (err: any, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["todos", activeUrl, filterTab, sortOrder],
          context.previousData
        );
      }
      const errorMsg =
        err.response?.data?.error?.message || err.message || "Failed to create task";
      showToast(errorMsg, "❌");
    },
    onSuccess: () => {
      showToast("Task added successfully", "✅");
      setNewTitle("");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title, done }: { id: string; title?: string; done?: boolean }) =>
      todoApi.updateTodo(id, { title, done }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previousData = queryClient.getQueryData<FetchTodosResponse>([
        "todos",
        activeUrl,
        filterTab,
        sortOrder,
      ]);

      if (previousData) { 
        queryClient.setQueryData(["todos", activeUrl, filterTab, sortOrder], {
          ...previousData,
          data: previousData.data.map((todo) =>
            todo.id === variables.id
              ? { ...todo, ...variables, updated_at: new Date().toISOString() }
              : todo
          ),
        });
      }

      return { previousData };
    },
    onError: (err: any, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["todos", activeUrl, filterTab, sortOrder],
          context.previousData
        );
      }
      const errorMsg =
        err.response?.data?.error?.message || err.message || "Failed to update task";
      showToast(errorMsg, "❌");
    },
    onSuccess: (data) => {
      showToast(data.done ? "Task completed!" : "Task active", "✓");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: todoApi.deleteTodo,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previousData = queryClient.getQueryData<FetchTodosResponse>([
        "todos",
        activeUrl,
        filterTab,
        sortOrder,
      ]);

      if (previousData) {
        queryClient.setQueryData(["todos", activeUrl, filterTab, sortOrder], {
          ...previousData,
          data: previousData.data.filter((todo) => todo.id !== id),
        });
      }

      return { previousData };
    },
    onError: (err: any, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["todos", activeUrl, filterTab, sortOrder],
          context.previousData
        );
      }
      const errorMsg =
        err.response?.data?.error?.message || err.message || "Failed to delete task";
      showToast(errorMsg, "❌");
    },
    onSuccess: () => {
      showToast("Task deleted", "🗑️");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
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

  // Filter todos by title search query client side
  const filteredTodos = todos.filter((todo) =>
    todo.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", paddingBottom: "1.5rem" }}>
          <div style={{ textAlign: "left" }}>
            <h1>Todo Cloud Manager</h1>
            <p className="subtitle">React Vite + TypeScript Frontend connected to FastAPI & DynamoDB</p>
          </div>
          <button 
            className="btn-secondary" 
            onClick={toggleTheme} 
            style={{ 
              padding: "0.5rem", 
              borderRadius: "50%", 
              width: "40px", 
              height: "40px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              fontSize: "1.2rem",
              background: "rgba(255, 255, 255, 0.05)"
            }} 
            title="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
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

      {/* Filter and Search card */}
      <section className="card filters-section">
        <div className="search-box" style={{ display: "flex", width: "100%" }}>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div className="filter-sort-controls">
          <div className="tabs">
            <button
              className={`tab-btn ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All
            </button>
            <button
              className={`tab-btn ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active
            </button>
            <button
              className={`tab-btn ${filterTab === "completed" ? "active" : ""}`}
              onClick={() => setFilterTab("completed")}
            >
              Completed
            </button>
          </div>
          <div className="sort-select">
            <label htmlFor="sort-order" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Sort:</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                fontFamily: "inherit",
                fontSize: "0.85rem",
                outline: "none"
              }}
            >
              <option value="-created_at">Newest first</option>
              <option value="created_at">Oldest first</option>
            </select>
          </div>
        </div>
      </section>

      {/* Task List card */}
      <section className="card todo-list-container">
        <div className="todo-list-header">
          <h3>My Tasks</h3>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {filteredTodos.length} task{filteredTodos.length === 1 ? "" : "s"}
          </span>
        </div>

        <ul className="todo-list">
          {isLoading ? (
            <div className="empty-state">
              <div className="spinner"></div>
              <p style={{ marginTop: "0.5rem" }}>Loading tasks from FastAPI & DynamoDB...</p>
            </div>
          ) : isError ? (
            <div className="empty-state">
              <p style={{ color: "var(--accent-red)", fontWeight: 500 }}>
                Failed to connect to API Backend
              </p>
              <p style={{ fontSize: "0.8rem", maxWidth: "80%", wordBreak: "break-all" }}>
                {(error as Error)?.message || "Network Error"}
              </p>
              <button
                className="btn-secondary"
                onClick={() => refetch()}
                style={{ marginTop: "0.5rem", padding: "0.4rem 1rem" }}
              >
                Retry
              </button>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="empty-state">
              <p>{searchQuery ? "No matching tasks found." : "No tasks yet. Create one above!"}</p>
            </div>
          ) : (
            filteredTodos.map((todo) => (
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
