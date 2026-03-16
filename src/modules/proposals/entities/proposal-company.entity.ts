import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Proposal } from './proposal.entity';

@Entity('proposal_companies')
export class ProposalCompany {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'proposal_id' })
  proposalId: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  industry?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ nullable: true })
  website?: string;

  @Column({ name: 'employee_count', nullable: true })
  employeeCount?: number;

  @Column({ nullable: true })
  followers?: number;

  @Column({ nullable: true })
  headquarters?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'linkedin_posts' })
  linkedinPosts?: Record<string, any>[];

  @Column({ type: 'jsonb', nullable: true, name: 'instagram_data' })
  instagramData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'facebook_data' })
  facebookData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'twitter_data' })
  twitterData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'tiktok_data' })
  tiktokData?: Record<string, any>;

  @OneToOne(() => Proposal, (proposal) => proposal.company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposal_id' })
  proposal: Proposal;
}
