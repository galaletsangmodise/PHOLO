import { INestApplication } from '@nestjs/common';
import { ApiExceptionFilter } from './common/exception.filter';

/** Settings shared by the real server and the tests: CORS is limited to WEB_ORIGIN, and every error leaves through ApiExceptionFilter (PRD 12.2). */
export function configureApp(app: INestApplication): void {
  const webOrigin = process.env.WEB_ORIGIN;
  app.enableCors({
    origin: webOrigin ? [webOrigin] : false,
    credentials: true,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
}
