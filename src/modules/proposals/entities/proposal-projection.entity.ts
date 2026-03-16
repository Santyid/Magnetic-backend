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

  @ManyToOne(() => Proposal, (proposal) => proposal.projections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposal_id' })
  proposal: Proposal;
}
