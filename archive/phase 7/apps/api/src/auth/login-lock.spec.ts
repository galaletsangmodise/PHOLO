import { LoginLock } from './login-lock';

describe('LoginLock (BR12)', () => {
  let now: number;
  let lock: LoginLock;
  beforeEach(() => {
    now = 1_000_000;
    lock = new LoginLock(() => now);
  });

  it('does not lock after 4 wrong passwords', () => {
    for (let i = 0; i < 4; i += 1) lock.recordFailure('a@x.co.za');
    expect(lock.isLocked('a@x.co.za')).toBe(false);
  });

  it('locks an email for 60 seconds after 5 wrong passwords', () => {
    for (let i = 0; i < 5; i += 1) lock.recordFailure('a@x.co.za');
    expect(lock.isLocked('a@x.co.za')).toBe(true);
    now += 59_999;
    expect(lock.isLocked('a@x.co.za')).toBe(true);
    now += 1;
    expect(lock.isLocked('a@x.co.za')).toBe(false);
  });

  it('starts counting again after the 60 seconds', () => {
    for (let i = 0; i < 5; i += 1) lock.recordFailure('a@x.co.za');
    now += 60_000;
    for (let i = 0; i < 4; i += 1) lock.recordFailure('a@x.co.za');
    expect(lock.isLocked('a@x.co.za')).toBe(false);
    lock.recordFailure('a@x.co.za');
    expect(lock.isLocked('a@x.co.za')).toBe(true);
  });

  it('a correct log-in resets the count', () => {
    for (let i = 0; i < 4; i += 1) lock.recordFailure('a@x.co.za');
    lock.reset('a@x.co.za');
    lock.recordFailure('a@x.co.za');
    expect(lock.isLocked('a@x.co.za')).toBe(false);
  });

  it('does not affect a different email, and ignores capital letters and spaces', () => {
    for (let i = 0; i < 5; i += 1) lock.recordFailure(' A@X.co.za ');
    expect(lock.isLocked('a@x.co.za')).toBe(true);
    expect(lock.isLocked('b@x.co.za')).toBe(false);
  });
});
