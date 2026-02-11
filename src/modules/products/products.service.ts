import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { UserProduct } from './entities/user-product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { AssignProductDto } from './dto/assign-product.dto';
import { SaveCredentialsDto } from './dto/save-credentials.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(UserProduct)
    private userProductsRepository: Repository<UserProduct>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const existingProduct = await this.productsRepository.findOne({
      where: [{ slug: createProductDto.slug }, { name: createProductDto.name }],
    });

    if (existingProduct) {
      throw new ConflictException('PRODUCT_ALREADY_EXISTS');
    }

    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find({
      where: { isActive: true },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { slug },
    });

    if (!product) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    return product;
  }

  async findUserProducts(userId: string): Promise<UserProduct[]> {
    return this.userProductsRepository.find({
      where: { userId, isActive: true },
      relations: ['product'],
    });
  }

  async assignProductToUser(
    userId: string,
    assignProductDto: AssignProductDto,
  ): Promise<UserProduct> {
    const product = await this.findOne(assignProductDto.productId);

    const existingAssignment = await this.userProductsRepository.findOne({
      where: {
        userId,
        productId: assignProductDto.productId,
      },
    });

    if (existingAssignment) {
      throw new ConflictException('PRODUCT_ALREADY_ASSIGNED');
    }

    const userProduct = this.userProductsRepository.create({
      userId,
      ...assignProductDto,
    });

    return this.userProductsRepository.save(userProduct);
  }

  async removeProductFromUser(
    userId: string,
    productId: string,
  ): Promise<void> {
    const userProduct = await this.userProductsRepository.findOne({
      where: { userId, productId },
    });

    if (!userProduct) {
      throw new NotFoundException('ASSIGNMENT_NOT_FOUND');
    }

    await this.userProductsRepository.remove(userProduct);
  }

  async updateProductAssignment(
    userProductId: string,
    updateData: Partial<{
      externalUserId: string;
      customDomain: string;
      metadata: Record<string, any>;
      isActive: boolean;
    }>,
  ): Promise<UserProduct> {
    const userProduct = await this.userProductsRepository.findOne({
      where: { id: userProductId },
      relations: ['product', 'user'],
    });

    if (!userProduct) {
      throw new NotFoundException('ASSIGNMENT_NOT_FOUND');
    }

    Object.assign(userProduct, updateData);
    return this.userProductsRepository.save(userProduct);
  }

  async saveCredentials(
    userProductId: string,
    dto: SaveCredentialsDto,
  ): Promise<UserProduct> {
    const userProduct = await this.userProductsRepository.findOne({
      where: { id: userProductId },
      relations: ['product', 'user'],
    });

    if (!userProduct) {
      throw new NotFoundException('ASSIGNMENT_NOT_FOUND');
    }

    if (dto.productEmail !== undefined) {
      userProduct.productEmail = dto.productEmail;
    }

    if (dto.password !== undefined) {
      userProduct.encryptedPassword = this.encryptionService.encrypt(
        dto.password,
      );
    }

    if (dto.apiToken !== undefined) {
      userProduct.apiToken = this.encryptionService.encrypt(dto.apiToken);
    }

    if (dto.enableMetrics !== undefined) {
      userProduct.enableMetrics = dto.enableMetrics;
    }

    return this.userProductsRepository.save(userProduct);
  }

  async deleteCredentials(userProductId: string): Promise<UserProduct> {
    const userProduct = await this.userProductsRepository.findOne({
      where: { id: userProductId },
      relations: ['product', 'user'],
    });

    if (!userProduct) {
      throw new NotFoundException('ASSIGNMENT_NOT_FOUND');
    }

    userProduct.productEmail = null;
    userProduct.encryptedPassword = null;
    userProduct.apiToken = null;
    userProduct.enableMetrics = false;

    return this.userProductsRepository.save(userProduct);
  }

  getDecryptedCredentials(userProduct: UserProduct): {
    productEmail?: string;
    password?: string;
    apiToken?: string;
  } {
    return {
      productEmail: userProduct.productEmail,
      password: userProduct.encryptedPassword
        ? this.encryptionService.decrypt(userProduct.encryptedPassword)
        : undefined,
      apiToken: userProduct.apiToken
        ? this.encryptionService.decrypt(userProduct.apiToken)
        : undefined,
    };
  }

  async generateAccessToken(
    userId: string,
    productSlug: string,
  ): Promise<{ accessToken: string; redirectUrl: string }> {
    const product = await this.findBySlug(productSlug);

    const userProduct = await this.userProductsRepository.findOne({
      where: {
        userId,
        productId: product.id,
        isActive: true,
      },
      relations: ['user'],
    });

    if (!userProduct) {
      throw new NotFoundException('PRODUCT_ACCESS_DENIED');
    }

    const payload = {
      sub: userId,
      email: userProduct.user.email,
      productId: product.id,
      productSlug: product.slug,
      externalUserId: userProduct.externalUserId,
      customDomain: userProduct.customDomain,
      metadata: userProduct.metadata,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: '1h',
    });

    let redirectUrl = product.baseUrl;
    if (userProduct.customDomain && productSlug === 'advocates') {
      redirectUrl = `https://${userProduct.customDomain}`;
    }

    return {
      accessToken,
      redirectUrl: `${redirectUrl}/auth/sso?token=${accessToken}`,
    };
  }
}
