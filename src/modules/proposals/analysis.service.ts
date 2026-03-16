import { Injectable } from '@nestjs/common';
import { GrowthClassification } from './entities/proposal-projection.entity';

export interface PostMetrics {
  likes: number;
  comments: number;
  reposts: number;
}

export interface PlatformData {
  platform: string;
  followers: number;
  posts: PostMetrics[];
  ambassadorCount: number;
  ambassadorFollowers: number; // Suma total de followers de los empleados embajadores
}

export interface ProjectionResult {
  platform: string;
  followers: number;
  currentAvgLikes: number;
  currentAvgComments: number;
  currentER: number;
  projectedLikes: number;
  projectedER: number;
  growthFactor: number;
  ambassadorCount: number;
  ambassadorFollowers: number;
  potentialReach: number;
  classification: GrowthClassification;
  recommendations: string[];
}

// Techo máximo de crecimiento por plataforma (refleja potencial viral de cada red)
const PLATFORM_MAX_GROWTH: Record<string, number> = {
  linkedin: 5.0,
  instagram: 4.0,
  facebook: 3.0,
  twitter: 6.0,
  tiktok: 8.0,
};

const PLATFORM_ER_BENCHMARKS: Record<string, number> = {
  linkedin: 0.35,
  instagram: 1.5,
  facebook: 0.5,
  twitter: 0.4,
  tiktok: 3.0,
};

@Injectable()
export class AnalysisService {
  calculate(data: PlatformData): ProjectionResult {
    const maxGrowth = PLATFORM_MAX_GROWTH[data.platform] ?? 4.0;
    const benchmark = PLATFORM_ER_BENCHMARKS[data.platform] ?? 1.0;

    const avgLikes = this.average(data.posts.map((p) => p.likes));
    const avgComments = this.average(data.posts.map((p) => p.comments));
    const avgEngagement = this.average(
      data.posts.map((p) => p.likes + p.comments + (p.reposts ?? 0)),
    );

    const currentER =
      data.followers > 0 ? (avgEngagement / data.followers) * 100 : 0;

    // potentialReach = seguidores empresa + seguidores totales empleados LinkedIn
    const potentialReach = data.followers + data.ambassadorFollowers;

    // growthFactor = cuánto crece el alcance al sumar la red de empleados
    // Acotado por el techo de cada plataforma
    const rawGrowthFactor =
      data.followers > 0 ? potentialReach / data.followers : maxGrowth;
    const growthFactor = Math.min(
      Math.round(rawGrowthFactor * 10) / 10,
      maxGrowth,
    );

    const projectedLikes = Math.round(avgLikes * growthFactor);
    const projectedER = Math.min(currentER * growthFactor, 100);

    const classification = this.classify(currentER, benchmark);
    const recommendations = this.buildRecommendations(
      data.platform,
      potentialReach,
      data.followers,
      data.ambassadorCount,
      data.posts.length,
      classification,
    );

    return {
      platform: data.platform,
      followers: data.followers,
      currentAvgLikes: Math.round(avgLikes * 10) / 10,
      currentAvgComments: Math.round(avgComments * 10) / 10,
      currentER: Math.round(currentER * 100) / 100,
      projectedLikes,
      projectedER: Math.round(projectedER * 100) / 100,
      growthFactor,
      ambassadorCount: data.ambassadorCount,
      ambassadorFollowers: data.ambassadorFollowers,
      potentialReach,
      classification,
      recommendations,
    };
  }

  private classify(currentER: number, benchmark: number): GrowthClassification {
    if (currentER < benchmark * 0.5) return 'HIGH';
    if (currentER < benchmark) return 'MEDIUM';
    return 'LOW';
  }

  private buildRecommendations(
    platform: string,
    potentialReach: number,
    companyFollowers: number,
    employeeCount: number,
    postCount: number,
    classification: GrowthClassification,
  ): string[] {
    const recs: string[] = [];
    const platformNames: Record<string, string> = {
      linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
      twitter: 'Twitter/X', tiktok: 'TikTok',
    };
    const name = platformNames[platform] ?? platform;
    const maxGrowth = PLATFORM_MAX_GROWTH[platform] ?? 4.0;

    if (classification === 'HIGH') {
      recs.push(`Alto potencial en ${name}: la empresa tiene margen significativo para crecer activando a sus empleados como amplificadores.`);
      recs.push(`Con Adpro, el alcance potencial pasa de ${this.fmt(companyFollowers)} a ${this.fmt(potentialReach)} personas (${maxGrowth}x máximo en ${name}).`);
    } else if (classification === 'MEDIUM') {
      recs.push(`Potencial moderado en ${name}: activar empleados llevaría el alcance de ${this.fmt(companyFollowers)} a ${this.fmt(potentialReach)} personas.`);
    } else {
      recs.push(`${name} ya tiene buen desempeño. Con Adpro los empleados mantienen y escalan el alcance orgánico actual (${this.fmt(potentialReach)} personas).`);
    }

    if (employeeCount < 3) {
      recs.push(`Incorporar más empleados como amplificadores en ${name} incrementaría el alcance potencial de forma directa.`);
    }
    if (postCount < 3) {
      recs.push(`La baja frecuencia de publicación limita el alcance. Adpro recomienda al menos 3 posts semanales.`);
    }

    const platformTips: Record<string, string> = {
      linkedin: 'En LinkedIn, los posts de empleados tienen 2x más alcance que los publicados desde el perfil corporativo.',
      instagram: 'En Instagram, las Stories de empleados amplían el alcance sin afectar el feed principal.',
      facebook: 'En Facebook, el contenido compartido por empleados supera el alcance orgánico corporativo.',
      twitter: 'En Twitter/X, los retweets de empleados son la palanca más efectiva para aumentar la difusión.',
      tiktok: 'En TikTok, cualquier empleado puede viralizar contenido independientemente de su número de seguidores.',
    };
    if (platformTips[platform]) recs.push(platformTips[platform]);

    return recs;
  }

  private fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  }

  private average(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}
