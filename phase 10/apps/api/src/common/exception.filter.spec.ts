import { BadRequestException, HttpException, Logger, NotFoundException, PayloadTooLargeException, UnauthorizedException } from '@nestjs/common';
import { ApiExceptionFilter } from './exception.filter';

function run(exception: unknown, request: Record<string, unknown> = { method: 'POST', originalUrl: '/auth/login?x=1' }) {
  const sent: { status?: number; body?: unknown } = {};
  const response = { status: (code: number) => ({ json: (body: unknown) => { sent.status = code; sent.body = body; } }) };
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) };
  new ApiExceptionFilter().catch(exception, host as never);
  return sent;
}

describe('ApiExceptionFilter (PRD 12.2: raw errors never reach the user, T-INT-19)', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('our own exact messages pass through unchanged, with their status and extra fields (such as "field")', () => {
    expect(run(new HttpException({ message: 'Notes can be at most 2000 characters.', field: 'notes' }, 400))).toEqual({
      status: 400, body: { message: 'Notes can be at most 2000 characters.', field: 'notes' },
    });
    expect(run(new NotFoundException({ message: 'We could not find this visit.' }))).toEqual({ status: 404, body: { message: 'We could not find this visit.' } });
  });

  it('a Nest default error ("Unauthorized", "Forbidden", ...) becomes the PRD message for its status', () => {
    expect(run(new UnauthorizedException())).toEqual({ status: 401, body: { message: 'Your session has ended. Please log in again.' } });
    expect(run(new HttpException('Forbidden', 403))).toEqual({ status: 403, body: { message: 'You are not allowed to open this page.' } });
  });

  it('a body that cannot be read, an unknown route and a too-large body show the server message, never "Bad Request" or "Cannot GET"', () => {
    for (const exception of [new BadRequestException('Unexpected token } in JSON at position 12'), new NotFoundException('Cannot GET /nope'), new PayloadTooLargeException()]) {
      const sent = run(exception);
      expect((sent.body as { message: string }).message).toBe('Something went wrong on our side. Please try again.');
      expect(sent.status).toBe((exception as HttpException).getStatus());
    }
  });

  it('an unknown error (a bug, a database error) is 500 with the server message and none of its text', () => {
    const sent = run(new Error('duplicate key value violates unique constraint "patients_pkey"'));
    expect(sent).toEqual({ status: 500, body: { message: 'Something went wrong on our side. Please try again.' } });
    expect(JSON.stringify(sent)).not.toMatch(/constraint|patients_pkey|statusCode|Internal server error/);
  });

  it('T-INT-18 a server problem is logged with the method, the path and the error type only: no query, body, header, token or message', () => {
    run(new Error('password=Secret123 token=abc'), { method: 'POST', originalUrl: '/auth/login?email=a@b.co', body: { password: 'Secret123' }, headers: { authorization: 'Bearer abc' } });
    const logged = [...warn.mock.calls, ...error.mock.calls].flat().join(' ');
    expect(logged).toContain('POST /auth/login');
    expect(logged).toContain('Error');
    expect(logged).not.toMatch(/Secret123|Bearer|abc|a@b\.co|email=/);
  });

  it('refusals (4xx) are not logged at all', () => {
    run(new UnauthorizedException());
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
