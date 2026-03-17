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
  ambassadorFollowers: number;
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
  // ROI
  earnedMediaValue: number;
  costPerImpression: number;
  estimatedImpressions: number;
  // Industry benchmarks
  industryBenchmarkER: number;
  erVsBenchmark: number;
  industryLabel: string;
}

export interface AdvocacyScoreResult {
  score: number;
  breakdown: { category: string; score: number; maxScore: number; description: string }[];
}

// ── Platform constants ────────────────────────────────────────────────

const PLATFORM_MAX_GROWTH: Record<string, number> = {
  linkedin: 5.0, instagram: 4.0, facebook: 3.0, twitter: 6.0, tiktok: 8.0,
};

const PLATFORM_ER_BENCHMARKS: Record<string, number> = {
  linkedin: 0.35, instagram: 1.5, facebook: 0.5, twitter: 0.4, tiktok: 3.0,
};

const PLATFORM_CPM: Record<string, number> = {
  linkedin: 8.50, instagram: 5.00, facebook: 4.00, twitter: 3.50, tiktok: 2.50,
};

const ORGANIC_REACH_RATE: Record<string, number> = {
  linkedin: 0.10, instagram: 0.08, facebook: 0.03, twitter: 0.08, tiktok: 0.25,
};

// ── Industry benchmarks ───────────────────────────────────────────────

const INDUSTRY_BENCHMARKS: Record<string, Record<string, number>> = {
  technology:          { linkedin: 0.40, instagram: 1.2, facebook: 0.4, twitter: 0.5, tiktok: 2.5 },
  'financial services': { linkedin: 0.30, instagram: 1.0, facebook: 0.3, twitter: 0.3, tiktok: 2.0 },
  healthcare:          { linkedin: 0.35, instagram: 1.3, facebook: 0.5, twitter: 0.4, tiktok: 2.8 },
  education:           { linkedin: 0.45, instagram: 1.8, facebook: 0.6, twitter: 0.5, tiktok: 3.5 },
  retail:              { linkedin: 0.25, instagram: 1.6, facebook: 0.5, twitter: 0.3, tiktok: 3.2 },
  'consumer goods':    { linkedin: 0.25, instagram: 1.8, facebook: 0.5, twitter: 0.4, tiktok: 3.5 },
  manufacturing:       { linkedin: 0.30, instagram: 0.9, facebook: 0.3, twitter: 0.3, tiktok: 1.8 },
  'real estate':       { linkedin: 0.35, instagram: 1.4, facebook: 0.4, twitter: 0.3, tiktok: 2.5 },
  media:               { linkedin: 0.40, instagram: 2.0, facebook: 0.6, twitter: 0.6, tiktok: 4.0 },
  telecommunications:  { linkedin: 0.25, instagram: 1.0, facebook: 0.3, twitter: 0.3, tiktok: 2.0 },
};

const INDUSTRY_MAP: Record<string, string> = {
  'technology': 'technology', 'information technology': 'technology', 'software': 'technology',
  'computer software': 'technology', 'internet': 'technology', 'saas': 'technology',
  'financial services': 'financial services', 'banking': 'financial services', 'insurance': 'financial services',
  'fintech': 'financial services', 'finance': 'financial services',
  'hospital & health care': 'healthcare', 'healthcare': 'healthcare', 'pharmaceuticals': 'healthcare',
  'health': 'healthcare', 'medical': 'healthcare',
  'education': 'education', 'higher education': 'education', 'e-learning': 'education',
  'retail': 'retail', 'e-commerce': 'retail', 'apparel': 'retail',
  'consumer goods': 'consumer goods', 'food & beverages': 'consumer goods', 'fmcg': 'consumer goods',
  'manufacturing': 'manufacturing', 'automotive': 'manufacturing', 'industrial': 'manufacturing',
  'real estate': 'real estate', 'construction': 'real estate',
  'media': 'media', 'entertainment': 'media', 'marketing': 'media', 'advertising': 'media',
  'telecommunications': 'telecommunications', 'telecom': 'telecommunications',
};

const PLATFORM_NAMES: Record<string, string> = {
  linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
  twitter: 'Twitter/X', tiktok: 'TikTok',
};

@Injectable()
export class AnalysisService {

  // ── Main projection calculation ─────────────────────────────────────

  calculate(data: PlatformData, industry?: string): ProjectionResult {
    const maxGrowth = PLATFORM_MAX_GROWTH[data.platform] ?? 4.0;
    const { benchmark, industryLabel } = this.getIndustryBenchmark(data.platform, industry);

    const avgLikes = this.average(data.posts.map((p) => p.likes));
    const avgComments = this.average(data.posts.map((p) => p.comments));
    const avgEngagement = this.average(
      data.posts.map((p) => p.likes + p.comments + (p.reposts ?? 0)),
    );

    const currentER = data.followers > 0 ? (avgEngagement / data.followers) * 100 : 0;
    const potentialReach = data.followers + data.ambassadorFollowers;

    const rawGrowthFactor = data.followers > 0 ? potentialReach / data.followers : maxGrowth;
    const growthFactor = Math.min(Math.round(rawGrowthFactor * 10) / 10, maxGrowth);

    const projectedLikes = Math.round(avgLikes * growthFactor);
    const projectedER = Math.min(currentER * growthFactor, 100);

    const classification = this.classify(currentER, benchmark);

    // ROI
    const organicRate = ORGANIC_REACH_RATE[data.platform] ?? 0.08;
    const estimatedImpressions = Math.round(potentialReach * organicRate * 4); // 4 posts/month
    const cpm = PLATFORM_CPM[data.platform] ?? 5.0;
    const earnedMediaValue = Math.round((estimatedImpressions / 1000) * cpm);

    // Industry comparison
    const erVsBenchmark = benchmark > 0
      ? Math.round(((currentER - benchmark) / benchmark) * 100)
      : 0;

    const recommendations = this.buildRecommendations(
      data.platform, potentialReach, data.followers,
      data.ambassadorCount, data.posts.length, classification,
      earnedMediaValue, industryLabel, erVsBenchmark,
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
      earnedMediaValue,
      costPerImpression: cpm,
      estimatedImpressions,
      industryBenchmarkER: Math.round(benchmark * 100) / 100,
      erVsBenchmark,
      industryLabel,
    };
  }

  // ── Advocacy Readiness Score (0-100) ────────────────────────────────

  calculateAdvocacyScore(
    projections: ProjectionResult[],
    scrapedEmployeeCount: number,
    totalEmployeeFollowers: number,
    companyFollowers: number,
    companyEmployeeCount?: number,
    scrapedWithFollowers?: number,
  ): AdvocacyScoreResult {
    const totalPool = companyEmployeeCount ?? scrapedEmployeeCount;

    // teamSize: basado en el pool GLOBAL de empleados de la empresa
    const teamScore = totalPool >= 1000 ? 20 : totalPool >= 500 ? 18 : totalPool >= 200 ? 16
      : totalPool >= 100 ? 14 : totalPool >= 50 ? 12 : totalPool >= 20 ? 8
      : totalPool >= 10 ? 6 : totalPool >= 5 ? 4 : totalPool >= 1 ? 2 : 0;
    const teamDesc = totalPool >= 1000
      ? `${this.fmt(totalPool)} empleados disponibles para amplificar el mensaje de la marca`
      : totalPool >= 100
        ? `${this.fmt(totalPool)} empleados con potencial para convertirse en embajadores`
        : totalPool >= 10
          ? `${this.fmt(totalPool)} empleados identificados, equipo base para iniciar el programa`
          : `Equipo reducido, ideal para un piloto de advocacy focalizado`;

    // employeeReach: extrapolar desde la muestra scrapeada al pool global
    let reachScore: number;
    let reachDesc: string;
    const scrapedCount = scrapedWithFollowers ?? scrapedEmployeeCount;
    if (totalEmployeeFollowers > 0 && scrapedCount > 0) {
      // Promedio real de la muestra → extrapolar al pool total
      const avgFollowersPerEmployee = totalEmployeeFollowers / scrapedCount;
      const estimatedTotalReach = Math.round(avgFollowersPerEmployee * totalPool);
      const reachRatio = companyFollowers > 0 ? estimatedTotalReach / companyFollowers : 0;
      reachScore = Math.min(Math.round(reachRatio * 15), 25);
      const reachMultiplier = companyFollowers > 0 ? (estimatedTotalReach / companyFollowers) : 0;
      reachDesc = reachMultiplier >= 1
        ? `Los empleados pueden alcanzar ~${this.fmt(estimatedTotalReach)} personas, ${reachMultiplier.toFixed(1)}x más que la página corporativa`
        : `Los empleados pueden alcanzar ~${this.fmt(estimatedTotalReach)} personas adicionales a la audiencia corporativa`;
    } else if (totalPool > 0) {
      const estimatedReach = totalPool * 500;
      const reachRatio = companyFollowers > 0 ? estimatedReach / companyFollowers : 0;
      reachScore = Math.min(Math.round(reachRatio * 10), 15);
      reachDesc = `Se estima que los empleados pueden alcanzar ~${this.fmt(estimatedReach)} personas en conjunto`;
    } else {
      reachScore = 0;
      reachDesc = 'Sin datos de empleados';
    }

    const platformScore = Math.min(projections.length * 3, 15);

    const classScores: Record<string, number> = { HIGH: 25, MEDIUM: 15, LOW: 5 };
    const avgClassScore = projections.length > 0
      ? Math.round(projections.reduce((s, p) => s + (classScores[p.classification] ?? 10), 0) / projections.length)
      : 10;
    const growthScore = Math.min(avgClassScore, 25);

    const avgER = projections.length > 0
      ? projections.reduce((s, p) => s + p.currentER, 0) / projections.length
      : 0;
    const contentScore = avgER >= 2 ? 15 : avgER >= 1 ? 12 : avgER >= 0.3 ? 8 : 4;

    const score = Math.min(teamScore + reachScore + platformScore + growthScore + contentScore, 100);

    return {
      score,
      breakdown: [
        { category: 'teamSize', score: teamScore, maxScore: 20, description: teamDesc },
        { category: 'employeeReach', score: reachScore, maxScore: 25, description: reachDesc },
        { category: 'multiPlatform', score: platformScore, maxScore: 15, description: projections.length >= 4
          ? `Presencia sólida en ${projections.length} redes, máxima visibilidad para el programa`
          : projections.length >= 2
            ? `Activo en ${projections.length} redes sociales, buena base para amplificar contenido`
            : `Solo ${projections.length} red activa, activar más canales aumentaría el impacto significativamente` },
        { category: 'growthOpportunity', score: growthScore, maxScore: 25, description: avgClassScore >= 20
          ? 'Gran margen de mejora, el programa de advocacy puede generar un impacto inmediato'
          : avgClassScore >= 10
            ? 'Hay espacio para crecer, los empleados pueden potenciar el alcance actual'
            : 'El rendimiento actual ya es bueno, el programa ayudaría a mantenerlo y escalarlo' },
        { category: 'contentActivity', score: contentScore, maxScore: 15, description: avgER >= 2
          ? 'La audiencia interactúa activamente con el contenido, excelente punto de partida'
          : avgER >= 0.5
            ? 'Nivel de interacción moderado, hay oportunidad de aumentar el engagement con advocacy'
            : 'Baja interacción orgánica, el advocacy de empleados puede multiplicar las reacciones' },
      ],
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private getIndustryBenchmark(platform: string, industry?: string): { benchmark: number; industryLabel: string } {
    if (!industry) {
      return { benchmark: PLATFORM_ER_BENCHMARKS[platform] ?? 1.0, industryLabel: 'General' };
    }
    const normalized = industry.toLowerCase().trim();
    const mappedKey = INDUSTRY_MAP[normalized];

    if (mappedKey && INDUSTRY_BENCHMARKS[mappedKey]?.[platform]) {
      return { benchmark: INDUSTRY_BENCHMARKS[mappedKey][platform], industryLabel: this.capitalize(mappedKey) };
    }
    for (const [key, val] of Object.entries(INDUSTRY_MAP)) {
      if (normalized.includes(key) && INDUSTRY_BENCHMARKS[val]?.[platform]) {
        return { benchmark: INDUSTRY_BENCHMARKS[val][platform], industryLabel: this.capitalize(val) };
      }
    }
    return { benchmark: PLATFORM_ER_BENCHMARKS[platform] ?? 1.0, industryLabel: industry };
  }

  private classify(currentER: number, benchmark: number): GrowthClassification {
    if (currentER < benchmark * 0.5) return 'HIGH';
    if (currentER < benchmark) return 'MEDIUM';
    return 'LOW';
  }

  private buildRecommendations(
    platform: string, potentialReach: number, companyFollowers: number,
    employeeCount: number, postCount: number, classification: GrowthClassification,
    earnedMediaValue: number, industryLabel: string, erVsBenchmark: number,
  ): string[] {
    const recs: string[] = [];
    const name = PLATFORM_NAMES[platform] ?? platform;
    const maxGrowth = PLATFORM_MAX_GROWTH[platform] ?? 4.0;

    if (classification === 'HIGH') {
      recs.push(`Alto potencial en ${name}: la empresa tiene margen significativo para crecer activando a sus empleados como amplificadores.`);
      recs.push(`Con Adpro, el alcance potencial pasa de ${this.fmt(companyFollowers)} a ${this.fmt(potentialReach)} personas (${maxGrowth}x máximo en ${name}).`);
    } else if (classification === 'MEDIUM') {
      recs.push(`Potencial moderado en ${name}: activar empleados llevaría el alcance de ${this.fmt(companyFollowers)} a ${this.fmt(potentialReach)} personas.`);
    } else {
      recs.push(`${name} ya tiene buen desempeño. Con Adpro los empleados mantienen y escalan el alcance orgánico actual (${this.fmt(potentialReach)} personas).`);
    }

    if (erVsBenchmark < 0) {
      recs.push(`El engagement rate está ${Math.abs(erVsBenchmark)}% por debajo del promedio de ${industryLabel}. Hay oportunidad clara de mejora con employee advocacy.`);
    } else if (erVsBenchmark > 20) {
      recs.push(`El engagement rate supera el promedio de ${industryLabel} por ${erVsBenchmark}%. El programa de advocacy puede mantener esta ventaja competitiva.`);
    }

    if (earnedMediaValue > 0) {
      recs.push(`Valor estimado en earned media: $${this.fmt(earnedMediaValue)} USD/mes, equivalente al ahorro en pauta pagada.`);
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

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
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
