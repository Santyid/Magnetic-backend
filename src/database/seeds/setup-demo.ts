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

async function setupDemo() {
  try {
    console.log('🚀 Configurando demo completo de Login Magnetic...\n');

    await AppDataSource.initialize();
    console.log('✅ Conexión a la base de datos establecida\n');

    const userRepository = AppDataSource.getRepository(User);
    const productRepository = AppDataSource.getRepository(Product);
    const userProductRepository = AppDataSource.getRepository(UserProduct);

    // 1. Crear productos si no existen
    console.log('📦 Creando productos...');
    const productsData = [
      {
        name: 'SocialGest',
        slug: 'socialgest',
        baseUrl: process.env.SOCIALGEST_URL || 'https://socialgest.com',
        description: 'Gestión de redes sociales',
      },
      {
        name: 'Tikket',
        slug: 'tikket',
        baseUrl: process.env.TIKKET_URL || 'https://tikket.com',
        description: 'Sistema de tickets y soporte',
      },
      {
        name: 'Advocates',
        slug: 'advocates',
        baseUrl: process.env.ADVOCATES_URL || 'https://advocates.com',
        description: 'Plataforma de advocacy con subdominios personalizados',
      },
      {
        name: 'Quantico',
        slug: 'quantico',
        baseUrl: process.env.QUANTICO_URL || 'https://quantico.com',
        description: 'Analytics y métricas',
      },
    ];

    const products = [];
    for (const productData of productsData) {
      let product = await productRepository.findOne({
        where: { slug: productData.slug },
      });

      if (!product) {
        product = productRepository.create(productData);
        await productRepository.save(product);
        console.log(`  ✅ ${productData.name} creado`);
      } else {
        console.log(`  ⏭️  ${productData.name} ya existe`);
      }
      products.push(product);
    }

    console.log('');

    // 2. Crear usuario admin
    console.log('👤 Creando usuario administrador...');
    const adminEmail = 'admin@magnetic.com';
    let adminUser = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      adminUser = userRepository.create({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Magnetic',
        isAdmin: true,
        isActive: true,
      });
      await userRepository.save(adminUser);
      console.log('  ✅ Usuario admin creado');
      console.log(`     Email: ${adminEmail}`);
      console.log('     Password: Admin123!');
    } else {
      // Asegurar que es admin
      if (!adminUser.isAdmin) {
        adminUser.isAdmin = true;
        await userRepository.save(adminUser);
        console.log('  ✅ Usuario actualizado a admin');
      } else {
        console.log('  ⏭️  Usuario admin ya existe');
      }
    }

    console.log('');

    // 3. Crear usuario demo con acceso a los 4 productos
    console.log('👤 Creando usuario demo...');
    const demoEmail = 'demo@magnetic.com';
    let demoUser = await userRepository.findOne({
      where: { email: demoEmail },
    });

    if (!demoUser) {
      const hashedPassword = await bcrypt.hash('Demo123!', 10);
      demoUser = userRepository.create({
        email: demoEmail,
        password: hashedPassword,
        firstName: 'Demo',
        lastName: 'User',
        isAdmin: false,
        isActive: true,
      });
      await userRepository.save(demoUser);
      console.log('  ✅ Usuario demo creado');
      console.log(`     Email: ${demoEmail}`);
      console.log('     Password: Demo123!');
    } else {
      console.log('  ⏭️  Usuario demo ya existe');
    }

    console.log('');

    // 4. Asignar los 4 productos al usuario demo
    console.log('🔗 Asignando productos al usuario demo...');

    const [socialgest, tikket, advocates, quantico] = products;

    const assignments = [
      {
        product: socialgest,
        externalUserId: 'demo-socialgest-001',
        customDomain: null,
        metadata: { role: 'user' },
      },
      {
        product: tikket,
        externalUserId: 'demo-tikket-002',
        customDomain: null,
        metadata: { role: 'support' },
      },
      {
        product: advocates,
        externalUserId: 'demo-advocates-003',
        customDomain: 'demo-company.advocates.com',
        metadata: { companyName: 'Demo Company', role: 'admin' },
      },
      {
        product: quantico,
        externalUserId: 'demo-quantico-004',
        customDomain: null,
        metadata: { role: 'analyst' },
      },
    ];

    for (const assignment of assignments) {
      const existing = await userProductRepository.findOne({
        where: {
          userId: demoUser.id,
          productId: assignment.product.id,
        },
      });

      if (!existing) {
        const userProduct = userProductRepository.create({
          userId: demoUser.id,
          productId: assignment.product.id,
          externalUserId: assignment.externalUserId,
          customDomain: assignment.customDomain,
          metadata: assignment.metadata,
          isActive: true,
        });
        await userProductRepository.save(userProduct);
        console.log(`  ✅ ${assignment.product.name} asignado`);
      } else {
        console.log(`  ⏭️  ${assignment.product.name} ya asignado`);
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 Setup demo completado exitosamente!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('📝 Credenciales de prueba:');
    console.log('');
    console.log('👨‍💼 Usuario Admin:');
    console.log(`   Email:    ${adminEmail}`);
    console.log('   Password: Admin123!');
    console.log('   Rol:      Administrador (puede gestionar usuarios)');
    console.log('');
    console.log('👤 Usuario Demo:');
    console.log(`   Email:    ${demoEmail}`);
    console.log('   Password: Demo123!');
    console.log('   Productos: SocialGest, Tikket, Advocates, Quantico');
    console.log('');
    console.log('🔗 Puedes hacer login en:');
    console.log('   POST http://localhost:3000/api/auth/login');
    console.log('');
    console.log('📚 Ver productos del usuario:');
    console.log('   GET http://localhost:3000/api/products');
    console.log('   (con Authorization: Bearer TOKEN)');
    console.log('');
    console.log('🚀 Generar token SSO para un producto:');
    console.log('   GET http://localhost:3000/api/products/quantico/access');
    console.log('   (con Authorization: Bearer TOKEN)');
    console.log('');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

setupDemo();
