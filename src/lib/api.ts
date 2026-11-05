const TOKEN_KEY = 'brit_auto_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setStoredToken(null);
    window.dispatchEvent(new CustomEvent('brit:unauthorized'));
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok || contentType.includes('text/html')) {
      throw new ApiClientError(
        res.status || 503,
        'API_UNAVAILABLE',
        `Layanan API sedang memuat ulang (${res.status})`
      );
    }
    return (await res.text()) as unknown as T;
  }

  const data = await res.json();
  if (!res.ok) {
    const code = data?.error?.code || 'ERROR';
    const msg = data?.error?.message || 'Terjadi kesalahan saat memproses permintaan';
    throw new ApiClientError(res.status, code, msg);
  }

  return data as T;
}
