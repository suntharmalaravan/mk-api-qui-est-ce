import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true, // En production, spécifiez les domaines autorisés
    credentials: true,
  });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non définies dans le DTO
      forbidNonWhitelisted: true, // Lance une erreur si des propriétés non autorisées sont présentes
      transform: true, // Transforme automatiquement les types
    }),
  );

  await app.listen(process.env.PORT || 8080);
}
bootstrap();
