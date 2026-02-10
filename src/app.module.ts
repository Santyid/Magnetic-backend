import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AiModule } from './modules/ai/ai.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { HealthController } from './health.controller';
import { User } from './modules/users/entities/user.entity';
import { Product } from './modules/products/entities/product.entity';
import { UserProduct } from './modules/products/entities/user-product.entity';
import { Session } from './modules/sessions/entities/session.entity';
import { PasswordResetToken } from './modules/auth/entities/password-reset-token.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [User, Product, UserProduct, Session, PasswordResetToken],
        synchronize: true, // ¡Solo en desarrollo! Cambiar a false en producción
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    SessionsModule,
    AiModule,
    DashboardModule,
    CreatorsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
