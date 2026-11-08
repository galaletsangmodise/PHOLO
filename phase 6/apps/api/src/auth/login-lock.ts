/** BR12: after 5 wrong passwords in a row for one email, that email is locked for 60 seconds. Kept in the API's memory (plan Section 18, #8). */
export const MAX_WRONG_PASSWORDS = 5;
export const LOCK_MILLISECONDS = 60_000;

interface Entry {
  failures: number;
  lockedUntil: number;
}

export class LoginLock {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  private key(email: string): string {
    return email.trim().toLowerCase();
  }

  isLocked(email: string): boolean {
    const entry = this.entries.get(this.key(email));
    if (!entry) return false;
    if (entry.lockedUntil > this.now()) return true;
    if (entry.lockedUntil !== 0) this.entries.delete(this.key(email)); // the 60 seconds are over: count again from 0
    return false;
  }

  recordFailure(email: string): void {
    const key = this.key(email);
    let entry = this.entries.get(key) ?? { failures: 0, lockedUntil: 0 };
    if (entry.lockedUntil !== 0 && entry.lockedUntil <= this.now()) entry = { failures: 0, lockedUntil: 0 }; // lock is over
    entry.failures += 1;
    if (entry.failures >= MAX_WRONG_PASSWORDS) entry.lockedUntil = this.now() + LOCK_MILLISECONDS;
    this.entries.set(key, entry);
  }

  reset(email: string): void {
    this.entries.delete(this.key(email));
  }
}
