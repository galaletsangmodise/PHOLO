/**
 * A toast that must show on the next screen (for example "Patient file created." on S8 after M2 on S7).
 * It lives in memory only and is read once.
 */
let pending: string | undefined;

export function setFlash(message: string): void {
  pending = message;
}

export function takeFlash(): string | undefined {
  const message = pending;
  pending = undefined;
  return message;
}
