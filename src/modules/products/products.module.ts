import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Product } from './entities/product.entity';
import { UserProduct } from './entities/user-product.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, UserProduct]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, EncryptionService],
  exports: [ProductsService, EncryptionService],
})
export class ProductsModule {}
