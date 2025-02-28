import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config/envs';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Orders');

  const app = await NestFactory.create(AppModule);

  await app.listen(envs.port);

  logger.log(`Orders microservice running on port ${envs.port}`);
}
void bootstrap();
