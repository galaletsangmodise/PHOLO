/**
 * "No internet" also comes from failed API calls (plan Section 18, #10): the banner goes when the next call succeeds.
 */
let reachable = true;
const listeners = new Set<() => void>();

export function setApiReachable(value: boolean): void {
  if (reachable === value) return;
  reachable = value;
  listeners.forEach((listener) => listener());
}

export function isApiReachable(): boolean {
  return reachable;
}

export function subscribeApiStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
