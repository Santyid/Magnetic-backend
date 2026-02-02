import { DataSource } from 'typeorm';
import { Product } from '../../modules/products/entities/product.entity';

export async function seedProducts(dataSource: DataSource) {
  const productRepository = dataSource.getRepository(Product);

  const products = [
    {
      name: 'SocialGest',
      slug: 'socialgest',
      baseUrl: process.env.SOCIALGEST_URL || 'https://socialgest.com',
      description: 'Gestión de redes sociales',
      isActive: true,
    },
    {
      name: 'Tikket',
      slug: 'tikket',
      baseUrl: process.env.TIKKET_URL || 'https://tikket.com',
      description: 'Sistema de tickets y soporte',
      isActive: true,
    },
    {
      name: 'Advocates',
      slug: 'advocates',
      baseUrl: process.env.ADVOCATES_URL || 'https://advocates.com',
      description: 'Plataforma de advocacy con subdominios personalizados',
      isActive: true,
    },
    {
      name: 'Quantico',
      slug: 'quantico',
      baseUrl: process.env.QUANTICO_URL || 'https://quantico.com',
      description: 'Analytics y métricas',
      isActive: true,
    },
  ];

  for (const productData of products) {
    const existingProduct = await productRepository.findOne({
      where: { slug: productData.slug },
    });

    if (!existingProduct) {
      const product = productRepository.create(productData);
      await productRepository.save(product);
      console.log(`✅ Producto creado: ${productData.name}`);
    } else {
      console.log(`⏭️  Producto ya existe: ${productData.name}`);
    }
  }

  console.log('🎉 Seed de productos completado');
}
