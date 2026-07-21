const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

export function getHeaders(isAdmin: boolean = false): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isAdmin) {
    const adminKey = localStorage.getItem('sm_admin_key');
    if (adminKey) headers['X-Admin-Key'] = adminKey;
  } else {
    const partnerKey = localStorage.getItem('sm_partner_key') || 'sm_demo_key_123';
    headers['X-Api-Key'] = partnerKey;
  }
  return headers;
}

export interface Partner {
  id: string;
  name: string;
  api_key?: string;
  allowed_origin: string;
  daily_limit: number;
  created_at: string;
}

export interface PartnerUsage {
  partner: Partner;
  used_today: number;
}

export async function getAdminPartners(): Promise<PartnerUsage[]> {
  const resp = await fetch(`${API_BASE}/api/admin/partners`, { headers: getHeaders(true) });
  if (!resp.ok) throw new Error('Failed to fetch partners');
  return resp.json();
}

export async function createPartner(name: string, origin: string, limit: number): Promise<Partner> {
  const resp = await fetch(`${API_BASE}/api/admin/partners`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ name, allowed_origin: origin, daily_limit: limit }),
  });
  if (!resp.ok) throw new Error('Failed to create partner');
  return resp.json();
}

export async function getUsage(): Promise<{ used_today: number; limit: number }> {
  const resp = await fetch(`${API_BASE}/api/usage`, { headers: getHeaders(false) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ... (submitTryOn, pollStatus should use getHeaders(false) instead of X-Client-Id)
export async function submitTryOn(garmentUrl: string, bodyUrl: string, prompt?: string) {
  const resp = await fetch(`${API_BASE}/api/tryon`, {
    method: 'POST',
    headers: getHeaders(false),
    body: JSON.stringify({ garment_url: garmentUrl, body_url: bodyUrl, garment_prompt: prompt }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

export async function pollStatus(taskId: string) {
  const resp = await fetch(`${API_BASE}/api/tryon/${taskId}`, { headers: getHeaders(false) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function deletePartner(id: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/admin/partners/${id}`, {
    method: 'DELETE',
    headers: getHeaders(true),
  });
  if (!resp.ok) throw new Error('Failed to delete partner');
}

export function logout(isAdmin: boolean = false) {
  if (isAdmin) {
    localStorage.removeItem('sm_admin_key');
  } else {
    localStorage.removeItem('sm_partner_key');
  }
  window.location.reload();
}

export interface UsageLog {
  partner_name: string;
  task_id: string;
  task_status: string;
  created_at: string;
}

export async function getUsageLogs(): Promise<UsageLog[]> {
  const resp = await fetch(`${API_BASE}/api/admin/logs`, { headers: getHeaders(true) });
  if (!resp.ok) throw new Error('Failed to fetch logs');
  return resp.json();
}

export async function getPartnerLogs(): Promise<UsageLog[]> {
  const resp = await fetch(`${API_BASE}/api/logs`, { headers: getHeaders(false) });
  if (!resp.ok) throw new Error('Failed to fetch logs');
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}
