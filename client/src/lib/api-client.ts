// Base API client with unified error handling

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export class ApiError extends Error {
  status: number;
  data?: unknown;
  
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.error || data.message || message;
      throw new ApiError(message, response.status, data);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(message, response.status);
    }
  }
  
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text() as unknown as T;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  
  const config: RequestInit = {
    method,
    headers: {
      ...headers,
    },
  };

  if (body !== undefined) {
    config.headers = {
      ...config.headers,
      "Content-Type": "application/json",
    };
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  return handleResponse<T>(response);
}

// HTTP methods
export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  
  post: <T>(endpoint: string, body?: unknown) => 
    request<T>(endpoint, { method: "POST", body }),
  
  put: <T>(endpoint: string, body?: unknown) => 
    request<T>(endpoint, { method: "PUT", body }),
  
  delete: <T>(endpoint: string) => 
    request<T>(endpoint, { method: "DELETE" }),
};

export { API_BASE };

