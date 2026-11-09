import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { MESSAGES } from '../auth/auth.types';

const PRD_MESSAGES: readonly string[] = Object.values(MESSAGES);

/** What the user reads for an error we did not write ourselves (PRD 12.2). Raw codes and texts never reach the user. */
function messageForStatus(status: number): string {
  if (status === 401) return MESSAGES.sessionEnded;
  if (status === 403) return MESSAGES.notAllowed;
  if (status === 429) return MESSAGES.tooManyTries;
  return MESSAGES.serverProblem;
}

/**
 * The one place where every error leaves the API (PRD 12.2, T-INT-18, T-INT-19).
 * - Our own refusals carry their exact message (and a "field", where there is one) and pass through unchanged.
 * - Anything else (a Nest default such as "Bad Request" or "Cannot GET /x", or an unexpected error) becomes the PRD message for its status.
 * - Only server problems are logged, and only as "METHOD /path -> status ErrorType": never a query, body, header, token or message text.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const body = exception instanceof HttpException ? this.bodyOf(exception.getResponse(), status) : { message: MESSAGES.serverProblem };

    if (status >= 500) {
      const request = context.getRequest<{ method?: string; originalUrl?: string }>();
      const path = (request.originalUrl ?? '').split('?')[0];
      const type = exception instanceof Error ? exception.constructor.name : 'UnknownError';
      this.logger.error(`${request.method ?? ''} ${path} -> ${status} ${type}`);
    }
    context.getResponse<{ status: (code: number) => { json: (payload: unknown) => void } }>().status(status).json(body);
  }

  private bodyOf(response: string | object, status: number): Record<string, unknown> {
    if (typeof response === 'string') {
      return { message: PRD_MESSAGES.includes(response) ? response : messageForStatus(status) };
    }
    const fields = response as Record<string, unknown>;
    // An object we wrote has a message and no "statusCode"; Nest's own default errors have both.
    if (typeof fields.message === 'string' && !('statusCode' in fields)) return { ...fields };
    return { message: messageForStatus(status) };
  }
}
