import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * Catch-all exception filter. Returns a consistent JSON error envelope and,
 * crucially, never leaks stack traces or internal error messages for
 * unexpected (non-HttpException) errors — those are logged server-side and
 * surfaced to clients as a generic 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';
    // Extra payload alongside `message` (e.g. the parser's `errors` array for a
    // 422). Nest clients read these fields, so a filter that rebuilt the body
    // from `message` alone silently dropped them.
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const { message: bodyMessage, error: bodyError, ...rest } = body as {
          message?: string | string[];
          error?: string;
        };
        message = bodyMessage ?? exception.message;
        error = bodyError ?? exception.name;
        extra = rest;
      }
    } else {
      // Unexpected error: log the detail, return an opaque message.
      this.log.error(
        `Unhandled error on ${req?.method} ${req?.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      ...extra,
      path: req?.url,
      timestamp: new Date().toISOString(),
    });
  }
}
