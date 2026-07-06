const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

/** API origin without the /api suffix — used to build static asset URLs (e.g. /uploads). */
export const API_ORIGIN = BASE.replace(/\/api\/?$/, '')

interface ApiOptions {
  /** Pass a token explicitly, or `null` to force an unauthenticated request. */
  token?: string | null
}

function storedToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem('accessToken') ?? undefined
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: ApiOptions = {},
): Promise<T> {
  const token = opts.token === null ? undefined : (opts.token ?? storedToken())
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error ?? 'Request failed')
  return data
}

export const apiGet = <T>(path: string, opts?: ApiOptions) => request<T>('GET', path, undefined, opts)
export const apiPost = <T>(path: string, body?: unknown, opts?: ApiOptions) =>
  request<T>('POST', path, body, opts)
export const apiPatch = <T>(path: string, body?: unknown, opts?: ApiOptions) =>
  request<T>('PATCH', path, body, opts)
export const apiDelete = <T>(path: string, opts?: ApiOptions) =>
  request<T>('DELETE', path, undefined, opts)

/** Multipart upload of the current user's avatar (accepts a cropped Blob). */
export async function uploadAvatar<T>(file: Blob, filename = 'avatar.jpg'): Promise<T> {
  const token = storedToken()
  const fd = new FormData()
  fd.append('avatar', file, filename)
  const res = await fetch(`${BASE}/users/me/avatar`, {
    method: 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: fd,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error ?? 'Upload failed')
  return data
}

/** Multipart upload of an image/video to the generic media endpoint. */
export async function uploadMedia<T>(file: File): Promise<T> {
  const token = storedToken()
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/media`, {
    method: 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: fd,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error ?? 'Upload failed')
  return data
}
