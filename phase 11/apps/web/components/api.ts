import { MESSAGES } from './messages';
import { setApiReachable } from './apiStatus';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** The rest of the server's answer (for example the field, or the id of an existing Patient File). */
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Calls the API. A call that cannot reach the server marks the app offline; the next success clears it. */
export async function apiRequest<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; token?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    setApiReachable(false);
    throw new ApiError(0, MESSAGES.offlineStaff);
  }
  setApiReachable(true);

  const data = (await response.json().catch(() => null)) as ({ message?: string } & Record<string, unknown>) | null;
  if (!response.ok) throw new ApiError(response.status, data?.message ?? MESSAGES.serverProblem, data ?? {});
  return data as T;
}
