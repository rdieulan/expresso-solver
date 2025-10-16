const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE) || ''

export async function fetchProfilesAPI(): Promise<any> {
  const res = await fetch(API_BASE + '/api/profiles');
  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await res.json();
  }
  // fallback: return text wrapped so caller can inspect
  const text = await res.text().catch(() => null);
  return { raw: text };
}

export async function fetchCurrentAPI(): Promise<any> {
  const res = await fetch(API_BASE + '/api/current');
  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await res.json();
  }
  const text = await res.text().catch(() => null);
  return { raw: text };
}

export async function decideAPI(params: { players?: string | number; depth?: string | number; hand?: string }): Promise<any> {
  const q = new URLSearchParams();
  if (params.players !== undefined) q.set('players', String(params.players));
  if (params.depth !== undefined) q.set('depth', String(params.depth));
  if (params.hand !== undefined) q.set('hand', String(params.hand));
  const res = await fetch(API_BASE + '/api/decide?' + q.toString());
  if (!res.ok) throw new Error((await res.json().catch(()=>null))?.error || res.statusText);
  return await res.json();
}

export async function uploadProfileAPI(name: string, jsonPayload: any): Promise<any> {
  const url = API_BASE + '/api/upload?name=' + encodeURIComponent(name || ('upload-' + Date.now()));
  const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(jsonPayload) });
  const body = await res.json().catch(()=>null);
  if (!res.ok) throw new Error(body?.error || res.statusText);
  return body;
}

export async function activateProfileAPI(name: string): Promise<any> {
  const url = API_BASE + '/api/profiles/select';
  const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }) });
  const body = await res.json().catch(()=>null);
  if (!res.ok) throw new Error(body?.error || res.statusText);
  return body;
}
