import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('creators')
@Unique(['platformId', 'platform'])
export class Creator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'platform_id' })
  @Index()
  platformId: string;

  @Column()
  @Index()
  platform: string;

  @Column()
  @Index()
  username: string;

  @Column()
  @Index()
  name: string;

  @Column({ name: 'profile_picture_url', type: 'text', nullable: true })
  profilePictureUrl: string;

  @Column({ name: 'followers_count', default: 0 })
  followersCount: number;

  @Column({ name: 'engagement_rate', type: 'float', default: 0 })
  engagementRate: number;

  @Column({ type: 'simple-json', nullable: true })
  categories: string[];

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ type: 'text', nullable: true })
  biography: string;

  @Column({ name: 'profile_url', type: 'text', nullable: true })
  profileUrl: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ name: 'age_bucket', nullable: true })
  ageBucket: string;

  @Column({ name: 'media_count', nullable: true })
  mediaCount: number;

  @Column({ name: 'avg_likes', nullable: true })
  avgLikes: number;

  @Column({ name: 'avg_comments', nullable: true })
  avgComments: number;

  @Column({ name: 'creator_price', type: 'float', nullable: true })
  creatorPrice: number;

  @Column({ nullable: true })
  currency: string;

  @Column({ name: 'median_views', nullable: true })
  medianViews: number;

  @Column({ type: 'simple-json', nullable: true })
  interests: string[];

  @Column({ name: 'sync_keyword', nullable: true })
  @Index()
  syncKeyword: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({
    name: 'last_synced_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastSyncedAt: Date;
}
