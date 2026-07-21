const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const CLIENT_ID_KEY = 'sm_client_id';

export function getClientId(): string {
  if (typeof localStorage === 'undefined') return 'ssr';
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = 'web_' + Math.random().toString(36).slice(2, 14);
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export interface SubmitResponse {
  task_id: string;
  status: string;
  estimated_sec: number;
}

export interface TaskStatus {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result_url?: string;
  error?: string;
  estimated_sec?: number;
  poll_after_ms: number;
}

export interface Usage {
  client_id: string;
  used: number;
  limit: number;
  window_sec: number;
  reset_at_unix: number;
}

export async function submitTryOn(garmentUrl: string, bodyUrl: string, prompt?: string): Promise<SubmitResponse> {
  const resp = await fetch(`${API_BASE}/api/tryon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
    body: JSON.stringify({ garment_url: garmentUrl, body_url: bodyUrl, garment_prompt: prompt }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

export async function pollStatus(taskId: string): Promise<TaskStatus> {
  const resp = await fetch(`${API_BASE}/api/tryon/${taskId}`, {
    headers: { 'X-Client-Id': getClientId() },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function getUsage(): Promise<Usage> {
  const resp = await fetch(`${API_BASE}/api/usage`, {
    headers: { 'X-Client-Id': getClientId() },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}



export { API_BASE };
