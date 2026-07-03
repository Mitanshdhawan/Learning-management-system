const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

interface ApiOptions {
  token?: string
}

async function request<T>(method: string, path: string, body?: unknown, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error ?? 'Request failed')
  return data
}

export const apiPost = <T>(path: string, body?: unknown, opts?: ApiOptions) =>
  request<T>('POST', path, body, opts)
export const apiGet = <T>(path: string, opts?: ApiOptions) => request<T>('GET', path, undefined, opts)
