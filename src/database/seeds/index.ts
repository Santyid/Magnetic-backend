import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { UserProduct } from '../../modules/products/entities/user-product.entity';
import { Session } from '../../modules/sessions/entities/session.entity';
import * as dotenv from 'dotenv';
import { seedProducts } from './products.seed';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'magnetic_db',
  entities: [User, Product, UserProduct, Session],
  synchronize: false,
});

async function runSeeds() {
  try {
    console.log('🌱 Iniciando seeds...\n');

    await AppDataSource.initialize();
    console.log('✅ Conexión a la base de datos establecida\n');

    await seedProducts(AppDataSource);

    console.log('\n✨ Todas las seeds han sido ejecutadas exitosamente');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando seeds:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

runSeeds();
