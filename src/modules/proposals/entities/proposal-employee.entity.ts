import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Proposal } from './proposal.entity';

@Entity('proposal_employees')
export class ProposalEmployee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'proposal_id' })
  proposalId: string;

  @Column({ name: 'linkedin_url', nullable: true })
  linkedinUrl?: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ name: 'linkedin_followers', nullable: true })
  linkedinFollowers?: number;

  @Column({ name: 'linkedin_articles', type: 'jsonb', nullable: true })
  linkedinArticles?: Record<string, any>[];

  @Column({ name: 'avg_article_likes', type: 'float', nullable: true })
  avgArticleLikes?: number;

  @ManyToOne(() => Proposal, (proposal) => proposal.employees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposal_id' })
  proposal: Proposal;
}
