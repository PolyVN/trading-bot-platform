import { getSession, signOut } from "next-auth/react"

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession()
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`
  }
  return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      body.error ?? `Request failed with status ${response.status}`,
      body.details
    )
  }
  return response.json() as Promise<T>
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = new URL(`${API_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

async function fetchWithRetry(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init)

  if (response.status === 401) {
    // Force session refresh and retry once
    const freshHeaders = await getAuthHeaders()
    const retryResponse = await fetch(input, {
      ...init,
      headers: { ...init?.headers, ...freshHeaders },
    })
    if (retryResponse.status === 401) {
      // Double 401 — session is truly expired, redirect to login
      await signOut({ redirect: true })
      throw new ApiError(401, "Session expired, redirecting to login")
    }
    return retryResponse
  }

  return response
}

export const api = {
  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const headers = await getAuthHeaders()
    const response = await fetchWithRetry(buildUrl(path, params), { headers })
    return handleResponse<T>(response)
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const response = await fetchWithRetry(buildUrl(path), {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const response = await fetchWithRetry(buildUrl(path), {
      method: "PATCH",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  async delete<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders()
    const response = await fetchWithRetry(buildUrl(path), {
      method: "DELETE",
      headers,
    })
    return handleResponse<T>(response)
  },
}

export { ApiError }
