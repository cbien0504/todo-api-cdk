import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import App from "./App";
import { todoApi } from "./api/todoApi";

// Mock the API module
vi.mock("./api/todoApi", () => {
  return {
    getApiBaseUrl: () => "http://testserver/",
    todoApi: {
      getTodos: vi.fn(),
      createTodo: vi.fn(),
      updateTodo: vi.fn(),
      deleteTodo: vi.fn(),
    },
  };
});

describe("Todo Cloud Manager APP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders headers and configuration section", async () => {
    vi.mocked(todoApi.getTodos).mockResolvedValue({ data: [], meta: { next_token: null } });
    render(<App />);

    expect(screen.getByText("Todo Cloud Manager")).toBeInTheDocument();
    expect(screen.getByText("API Endpoint Connection")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a task and press enter...")).toBeInTheDocument();
  });

  it("renders a list of todos fetched from the API", async () => {
    const mockTodos = [
      {
        id: "c460a8e6-c846-4951-ab6a-116460595687",
        title: "Mock Task 1",
        done: false,
        created_at: "2026-07-10T00:00:00Z",
        updated_at: "2026-07-10T00:00:00Z",
      },
      {
        id: "bd666b30-21c5-46f4-9348-b7afac588406",
        title: "Mock Task 2",
        done: true,
        created_at: "2026-07-10T01:00:00Z",
        updated_at: "2026-07-10T01:00:00Z",
      },
    ];

    vi.mocked(todoApi.getTodos).mockResolvedValue({ data: mockTodos, meta: { next_token: null } });
    render(<App />);

    // Wait for the tasks to load
    await waitFor(() => {
      expect(screen.getByText("Mock Task 1")).toBeInTheDocument();
      expect(screen.getByText("Mock Task 2")).toBeInTheDocument();
    });

    expect(screen.getByText("2 tasks")).toBeInTheDocument();
  });

  it("submits a new Todo through the form", async () => {
    vi.mocked(todoApi.getTodos).mockResolvedValue({ data: [], meta: { next_token: null } });
    vi.mocked(todoApi.createTodo).mockResolvedValue({
      id: "a421768f-4dfa-453a-987c-4ee0cfda9bd4",
      title: "New Created Task",
      done: false,
      created_at: "2026-07-10T02:00:00Z",
      updated_at: "2026-07-10T02:00:00Z",
    });

    render(<App />);

    // Wait for initial load
    await screen.findByText("0 tasks");

    const input = screen.getByPlaceholderText("Type a task and press enter...");
    const submitBtn = screen.getByRole("button", { name: /Add Task/i });

    fireEvent.change(input, { target: { value: "New Created Task" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(todoApi.createTodo).toHaveBeenCalled();
    });

    expect(vi.mocked(todoApi.createTodo).mock.calls[0][0]).toEqual({
      title: "New Created Task",
      done: false,
    });
  });
});
