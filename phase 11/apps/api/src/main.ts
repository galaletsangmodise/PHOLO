import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  // 0.0.0.0 so the Check-in Tablet can reach the API over the Wi-Fi.
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
