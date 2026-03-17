import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { ProposalCompany } from './proposal-company.entity';
import { ProposalEmployee } from './proposal-employee.entity';
import { ProposalProjection } from './proposal-projection.entity';

export type ProposalStatus = 'pending' | 'processing' | 'done' | 'failed';

@Entity('proposals')
export class Proposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'admin_user_id' })
  adminUserId: string;

  @Column({ name: 'linkedin_company_url', nullable: true })
  linkedinCompanyUrl?: string;

  @Column({ type: 'simple-array', default: 'linkedin' })
  platforms: string[];

  @Column({ default: 'pending' })
  status: ProposalStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'ai_analysis', type: 'text', nullable: true })
  aiAnalysis?: string;

  @Column({ name: 'company_name', nullable: true })
  companyName?: string;

  // Advocacy Readiness Score (0-100)
  @Column({ name: 'advocacy_score', type: 'jsonb', nullable: true })
  advocacyScore?: { score: number; breakdown: { category: string; score: number; maxScore: number; description: string }[] };

  // Total ROI across all platforms (monthly)
  @Column({ name: 'total_earned_media', type: 'float', nullable: true })
  totalEarnedMedia?: number;

  // Competitor analysis data
  @Column({ type: 'jsonb', nullable: true })
  competitors?: {
    name: string;
    slug: string;
    logo: string;
    followers: number;
    employeeCount: number;
    industry: string;
    website: string;
    headquarters: string;
    engagement: {
      avgLikes: number;
      avgComments: number;
      avgReposts: number;
      postCount: number;
      engagementRate: number;
      postsPerMonth: number;
    };
  }[] | null;

  // AI-generated competitive brand analysis
  @Column({ name: 'competitor_analysis', type: 'text', nullable: true })
  competitorAnalysis?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => ProposalCompany, (company) => company.proposal, { cascade: true })
  company: ProposalCompany;

  @OneToMany(() => ProposalEmployee, (employee) => employee.proposal, { cascade: true })
  employees: ProposalEmployee[];

  @OneToMany(() => ProposalProjection, (projection) => projection.proposal, { cascade: true })
  projections: ProposalProjection[];
}
