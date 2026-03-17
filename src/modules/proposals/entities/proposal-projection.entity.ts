import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Proposal } from './proposal.entity';

export type GrowthClassification = 'HIGH' | 'MEDIUM' | 'LOW';

@Entity('proposal_projections')
export class ProposalProjection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'proposal_id' })
  proposalId: string;

  @Column()
  platform: string;

  @Column({ nullable: true })
  followers?: number;

  @Column({ name: 'current_avg_likes', type: 'float', nullable: true })
  currentAvgLikes?: number;

  @Column({ name: 'current_avg_comments', type: 'float', nullable: true })
  currentAvgComments?: number;

  @Column({ name: 'current_er', type: 'float', nullable: true })
  currentER?: number;

  @Column({ name: 'projected_likes', type: 'float', nullable: true })
  projectedLikes?: number;

  @Column({ name: 'projected_er', type: 'float', nullable: true })
  projectedER?: number;

  @Column({ name: 'growth_factor', type: 'float', nullable: true })
  growthFactor?: number;

  @Column({ name: 'ambassador_count', nullable: true })
  ambassadorCount?: number;

  @Column({ name: 'ambassador_followers', nullable: true })
  ambassadorFollowers?: number;

  @Column({ name: 'potential_reach', nullable: true })
  potentialReach?: number;

  @Column({ name: 'classification', nullable: true })
  classification?: GrowthClassification;

  @Column({ type: 'jsonb', nullable: true })
  recommendations?: string[];

  // ROI
  @Column({ name: 'earned_media_value', type: 'float', nullable: true })
  earnedMediaValue?: number;

  @Column({ name: 'cost_per_impression', type: 'float', nullable: true })
  costPerImpression?: number;

  @Column({ name: 'estimated_impressions', nullable: true })
  estimatedImpressions?: number;

  // Industry benchmarks
  @Column({ name: 'industry_benchmark_er', type: 'float', nullable: true })
  industryBenchmarkER?: number;

  @Column({ name: 'er_vs_benchmark', type: 'float', nullable: true })
  erVsBenchmark?: number;

  @Column({ name: 'industry_label', nullable: true })
  industryLabel?: string;

  @ManyToOne(() => Proposal, (proposal) => proposal.projections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposal_id' })
  proposal: Proposal;
}
