import { INestApplication } from '@nestjs/common';

/** Settings shared by the real server and the tests: CORS is limited to WEB_ORIGIN. */
export function configureApp(app: INestApplication): void {
  const webOrigin = process.env.WEB_ORIGIN;
  app.enableCors({
    origin: webOrigin ? [webOrigin] : false,
    credentials: true,
  });
}
