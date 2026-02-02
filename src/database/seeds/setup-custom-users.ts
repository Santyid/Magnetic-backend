import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { UserProduct } from '../../modules/products/entities/user-product.entity';
import { Session } from '../../modules/sessions/entities/session.entity';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'magnetic_db',
  entities: [User, Product, UserProduct, Session],
  synchronize: true,
});

async function setupCustomUsers() {
  try {
    console.log('🚀 Creando usuarios personalizados con productos...\n');

    await AppDataSource.initialize();
    console.log('✅ Conexión a la base de datos establecida\n');

    const userRepository = AppDataSource.getRepository(User);
    const productRepository = AppDataSource.getRepository(Product);
    const userProductRepository = AppDataSource.getRepository(UserProduct);

    // 1. Verificar que existen los productos
    console.log('📦 Verificando productos existentes...');
    const products = await productRepository.find();

    if (products.length < 3) {
      console.log('⚠️  Error: Se necesitan al menos 3 productos en la base de datos.');
      console.log('   Ejecuta primero: npm run seed:demo');
      await AppDataSource.destroy();
      process.exit(1);
    }

    const [socialgest, tikket, advocates, quantico] = products;
    console.log(`  ✅ ${products.length} productos encontrados\n`);

    // 2. Crear Usuario 1 - Sin productos (0)
    console.log('👤 Creando Usuario 1 - Sin productos...');
    const user1Email = 'user1@magnetic.com';
    let user1 = await userRepository.findOne({ where: { email: user1Email } });

    if (!user1) {
      const hashedPassword = await bcrypt.hash('User123!', 10);
      user1 = userRepository.create({
        email: user1Email,
        password: hashedPassword,
        firstName: 'Usuario',
        lastName: 'Uno',
        isAdmin: false,
        isActive: true,
      });
      await userRepository.save(user1);
      console.log('  ✅ Usuario 1 creado');
      console.log(`     Email: ${user1Email}`);
      console.log('     Password: User123!');
      console.log('     Productos: 0 (ninguno)');
    } else {
      console.log('  ⏭️  Usuario 1 ya existe');
    }

    console.log('');

    // 3. Crear Usuario 2 - 1 producto (SocialGest)
    console.log('👤 Creando Usuario 2 - 1 producto...');
    const user2Email = 'user2@magnetic.com';
    let user2 = await userRepository.findOne({ where: { email: user2Email } });

    if (!user2) {
      const hashedPassword = await bcrypt.hash('User123!', 10);
      user2 = userRepository.create({
        email: user2Email,
        password: hashedPassword,
        firstName: 'Usuario',
        lastName: 'Dos',
        isAdmin: false,
        isActive: true,
      });
      await userRepository.save(user2);
      console.log('  ✅ Usuario 2 creado');
      console.log(`     Email: ${user2Email}`);
      console.log('     Password: User123!');
    } else {
      console.log('  ⏭️  Usuario 2 ya existe');
    }

    // Asignar 1 producto (SocialGest)
    const user2Product = await userProductRepository.findOne({
      where: { userId: user2.id, productId: socialgest.id },
    });

    if (!user2Product) {
      const userProduct = userProductRepository.create({
        userId: user2.id,
        productId: socialgest.id,
        externalUserId: 'user2-socialgest-001',
        customDomain: null,
        metadata: { role: 'user' },
        isActive: true,
      });
      await userProductRepository.save(userProduct);
      console.log(`     ✅ Producto asignado: ${socialgest.name}`);
    } else {
      console.log(`     ⏭️  Producto ya asignado: ${socialgest.name}`);
    }

    console.log('');

    // 4. Crear Usuario 3 - 2 productos (SocialGest, Tikket)
    console.log('👤 Creando Usuario 3 - 2 productos...');
    const user3Email = 'user3@magnetic.com';
    let user3 = await userRepository.findOne({ where: { email: user3Email } });

    if (!user3) {
      const hashedPassword = await bcrypt.hash('User123!', 10);
      user3 = userRepository.create({
        email: user3Email,
        password: hashedPassword,
        firstName: 'Usuario',
        lastName: 'Tres',
        isAdmin: false,
        isActive: true,
      });
      await userRepository.save(user3);
      console.log('  ✅ Usuario 3 creado');
      console.log(`     Email: ${user3Email}`);
      console.log('     Password: User123!');
    } else {
      console.log('  ⏭️  Usuario 3 ya existe');
    }

    // Asignar 2 productos (SocialGest, Tikket)
    const user3Products = [
      {
        product: socialgest,
        externalUserId: 'user3-socialgest-001',
        customDomain: null,
        metadata: { role: 'user' },
      },
      {
        product: tikket,
        externalUserId: 'user3-tikket-002',
        customDomain: null,
        metadata: { role: 'support' },
      },
    ];

    for (const assignment of user3Products) {
      const existing = await userProductRepository.findOne({
        where: { userId: user3.id, productId: assignment.product.id },
      });

      if (!existing) {
        const userProduct = userProductRepository.create({
          userId: user3.id,
          productId: assignment.product.id,
          externalUserId: assignment.externalUserId,
          customDomain: assignment.customDomain,
          metadata: assignment.metadata,
          isActive: true,
        });
        await userProductRepository.save(userProduct);
        console.log(`     ✅ Producto asignado: ${assignment.product.name}`);
      } else {
        console.log(`     ⏭️  Producto ya asignado: ${assignment.product.name}`);
      }
    }

    console.log('');

    // 5. Crear Usuario 4 - 3 productos (SocialGest, Tikket, Advocates)
    console.log('👤 Creando Usuario 4 - 3 productos...');
    const user4Email = 'user4@magnetic.com';
    let user4 = await userRepository.findOne({ where: { email: user4Email } });

    if (!user4) {
      const hashedPassword = await bcrypt.hash('User123!', 10);
      user4 = userRepository.create({
        email: user4Email,
        password: hashedPassword,
        firstName: 'Usuario',
        lastName: 'Cuatro',
        isAdmin: false,
        isActive: true,
      });
      await userRepository.save(user4);
      console.log('  ✅ Usuario 4 creado');
      console.log(`     Email: ${user4Email}`);
      console.log('     Password: User123!');
    } else {
      console.log('  ⏭️  Usuario 4 ya existe');
    }

    // Asignar 3 productos (SocialGest, Tikket, Advocates)
    const user4Products = [
      {
        product: socialgest,
        externalUserId: 'user4-socialgest-001',
        customDomain: null,
        metadata: { role: 'user' },
      },
      {
        product: tikket,
        externalUserId: 'user4-tikket-002',
        customDomain: null,
        metadata: { role: 'support' },
      },
      {
        product: advocates,
        externalUserId: 'user4-advocates-003',
        customDomain: 'user4-company.advocates.com',
        metadata: { companyName: 'User4 Company', role: 'admin' },
      },
    ];

    for (const assignment of user4Products) {
      const existing = await userProductRepository.findOne({
        where: { userId: user4.id, productId: assignment.product.id },
      });

      if (!existing) {
        const userProduct = userProductRepository.create({
          userId: user4.id,
          productId: assignment.product.id,
          externalUserId: assignment.externalUserId,
          customDomain: assignment.customDomain,
          metadata: assignment.metadata,
          isActive: true,
        });
        await userProductRepository.save(userProduct);
        console.log(`     ✅ Producto asignado: ${assignment.product.name}`);
      } else {
        console.log(`     ⏭️  Producto ya asignado: ${assignment.product.name}`);
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 Usuarios personalizados creados exitosamente!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📝 Resumen de usuarios:');
    console.log('');
    console.log('👤 Usuario 1 - Sin productos:');
    console.log(`   Email:    ${user1Email}`);
    console.log('   Password: User123!');
    console.log('   Productos: Ninguno (0)');
    console.log('');
    console.log('👤 Usuario 2 - 1 producto:');
    console.log(`   Email:    ${user2Email}`);
    console.log('   Password: User123!');
    console.log(`   Productos: ${socialgest.name}`);
    console.log('');
    console.log('👤 Usuario 3 - 2 productos:');
    console.log(`   Email:    ${user3Email}`);
    console.log('   Password: User123!');
    console.log(`   Productos: ${socialgest.name}, ${tikket.name}`);
    console.log('');
    console.log('👤 Usuario 4 - 3 productos:');
    console.log(`   Email:    ${user4Email}`);
    console.log('   Password: User123!');
    console.log(`   Productos: ${socialgest.name}, ${tikket.name}, ${advocates.name}`);
    console.log('');
    console.log('🔗 Puedes hacer login con cualquiera de estos usuarios en:');
    console.log('   POST http://localhost:3000/api/auth/login');
    console.log('');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

setupCustomUsers();
