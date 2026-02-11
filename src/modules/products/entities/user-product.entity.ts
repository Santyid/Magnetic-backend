import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from './product.entity';

@Entity('user_products')
@Index(['userId', 'productId'], { unique: true })
export class UserProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Index()
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'external_user_id' })
  externalUserId: string;

  @Column({ name: 'custom_domain', nullable: true })
  customDomain?: string;

  @Column({ name: 'product_email', nullable: true })
  productEmail?: string;

  @Column({ name: 'encrypted_password', type: 'text', nullable: true })
  encryptedPassword?: string;

  @Column({ name: 'api_token', type: 'text', nullable: true })
  apiToken?: string;

  @Column({ name: 'enable_metrics', default: false })
  enableMetrics: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.userProducts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, (product) => product.userProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
