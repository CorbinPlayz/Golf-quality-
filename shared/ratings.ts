import type {
  AerationStatus,
  CategoryBreakdown,
  ConditionReport,
  CourseConditionMetrics,
  DataConfidence,
  GreenSpeed,
  SurfaceFirmness,
  TimeWindowFilter,
  TrendDirection,
} from './types';

export interface RatingBandInfo {
  band: 'excellent' | 'good' | 'average' | 'below_average' | 'very_poor' | 'unrated';
  rangeLabel: string;
  shortLabel: string;
  description: string;
}

/**
 * Consistent 1–10 condition rating scale used across all Fairway views and forms.
 */
export function getRatingBand(score: number | null | undefined): RatingBandInfo {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return {
      band: 'unrated',
      rangeLabel: '—',
      shortLabel: 'Insufficient Recent Data',
      description: 'Not enough recent golfer condition reports to establish a current score.',
    };
  }
  if (score >= 9.0) {
    return {
      band: 'excellent',
      rangeLabel: '9–10',
      shortLabel: 'Excellent Conditions',
      description: 'Tour/championship-caliber turf, pure true-rolling greens, crisp fairways, and manicured bunkers.',
    };
  }
  if (score >= 7.0) {
    return {
      band: 'good',
      rangeLabel: '7–8',
      shortLabel: 'Good Conditions',
      description: 'Well-maintained playing surfaces, smooth greens, clean fairway lies, and reliable bunkers.',
    };
  }
  if (score >= 5.0) {
    return {
      band: 'average',
      rangeLabel: '5–6',
      shortLabel: 'Average Conditions',
      description: 'Playable daily-fee standard with minor seasonal wear, slower greens, or occasional thin spots.',
    };
  }
  if (score >= 3.0) {
    return {
      band: 'below_average',
      rangeLabel: '3–4',
      shortLabel: 'Below Average Conditions',
      description: 'Noticeable turf stress, recent core aeration impact, bare lies, or inconsistent bunker sand.',
    };
  }
  return {
    band: 'very_poor',
    rangeLabel: '1–2',
    shortLabel: 'Very Poor Conditions',
    description: 'Severe turf loss, unplayable or heavily damaged greens, standing water, or major disruption.',
  };
}

export const RATING_SCALE_GUIDE = [
  { range: '1–2', min: 1, max: 2, label: 'Very poor conditions', detail: 'Unplayable areas, severe turf loss, or damaged greens' },
  { range: '3–4', min: 3, max: 4, label: 'Below average conditions', detail: 'Heavy aeration, patchy fairways, or inconsistent bunkers' },
  { range: '5–6', min: 5, max: 6, label: 'Average conditions', detail: 'Playable standard with routine wear or seasonal spots' },
  { range: '7–8', min: 7, max: 8, label: 'Good conditions', detail: 'True greens, lush fairways, and consistent bunkers' },
  { range: '9–10', min: 9, max: 10, label: 'Excellent conditions', detail: 'Pure championship surfaces across every part of the course' },
] as const;

const HALF_LIFE_DAYS = 7;
const DECAY_LAMBDA = Math.LN2 / HALF_LIFE_DAYS;
const CURRENT_WINDOW_DAYS = 30;

export function calculateReportWeight(createdAtIso: string, referenceNowMs: number = Date.now()): number {
  const reportMs = new Date(createdAtIso).getTime();
  const ageDays = Math.max(0, (referenceNowMs - reportMs) / (1000 * 60 * 60 * 24));
  if (ageDays > CURRENT_WINDOW_DAYS) {
    return 0;
  }
  return Math.exp(-DECAY_LAMBDA * ageDays);
}

export function getWindowMaxAgeHours(window: TimeWindowFilter): number | null {
  switch (window) {
    case '24h':
      return 24;
    case '7d':
      return 24 * 7;
    case '30d':
      return 24 * 30;
    case 'all':
      return null;
  }
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Computes transparent time-weighted current rating, latest rating, historical average,
 * category breakdowns, agronomy telemetry, confidence tier, and trend direction.
 */
export function computeCourseMetrics(
  allReportsInput: Pick<
    ConditionReport,
    | 'overallRating'
    | 'greensRating'
    | 'fairwaysRating'
    | 'bunkersRating'
    | 'roughRating'
    | 'teeBoxesRating'
    | 'greenSpeed'
    | 'firmness'
    | 'aerationStatus'
    | 'paceMinutes'
    | 'createdAt'
  >[],
  windowFilter: TimeWindowFilter = '30d',
  referenceNowMs: number = Date.now()
): CourseConditionMetrics {
  const sorted = [...allReportsInput].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalReportCount = sorted.length;
  if (totalReportCount === 0) {
    return {
      currentWeightedRating: null,
      windowWeightedRating: null,
      latestRating: null,
      latestReportAt: null,
      historicalAverageRating: null,
      totalReportCount: 0,
      recent30dReportCount: 0,
      recent7dReportCount: 0,
      recent24hReportCount: 0,
      windowReportCount: 0,
      trend: 'insufficient',
      trendDelta: null,
      confidence: 'none',
      confidenceLabel: 'No condition reports yet',
      isRankingReliable: false,
      categories: { greens: null, fairways: null, bunkers: null, rough: null, teeBoxes: null },
      telemetry: {
        greenSpeed: null,
        firmness: null,
        aerationStatus: null,
        avgPaceMinutes: null,
        recentAerationWarning: false,
      },
    };
  }

  const latest = sorted[0];
  const historicalSum = sorted.reduce((acc, r) => acc + r.overallRating, 0);
  const historicalAverageRating = round1(historicalSum / totalReportCount);

  const ageHoursOf = (iso: string) =>
    Math.max(0, (referenceNowMs - new Date(iso).getTime()) / (1000 * 60 * 60));

  const recent24h = sorted.filter((r) => ageHoursOf(r.createdAt) <= 24);
  const recent7d = sorted.filter((r) => ageHoursOf(r.createdAt) <= 24 * 7);
  const recent30d = sorted.filter((r) => ageHoursOf(r.createdAt) <= 24 * 30);

  const windowMaxHours = getWindowMaxAgeHours(windowFilter);
  const windowReports =
    windowMaxHours === null ? sorted : sorted.filter((r) => ageHoursOf(r.createdAt) <= windowMaxHours);

  const computeWeightedAvg = (
    items: typeof sorted,
    getter: (r: (typeof sorted)[number]) => number | null,
    allowUnboundedAge = false
  ): number | null => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const item of items) {
      const val = getter(item);
      if (val === null || val === undefined) continue;
      const ageDays = ageHoursOf(item.createdAt) / 24;
      const w = allowUnboundedAge
        ? Math.max(0.05, Math.exp(-DECAY_LAMBDA * ageDays))
        : calculateReportWeight(item.createdAt, referenceNowMs);
      if (w <= 0) continue;
      weightedSum += val * w;
      weightTotal += w;
    }
    if (weightTotal <= 0) return null;
    return round1(weightedSum / weightTotal);
  };

  // Current rating NEVER uses stale >30d reviews!
  const currentWeightedRating =
    recent30d.length > 0 ? computeWeightedAvg(recent30d, (r) => r.overallRating, false) : null;

  const windowWeightedRating =
    windowReports.length > 0
      ? computeWeightedAvg(windowReports, (r) => r.overallRating, windowFilter === 'all')
      : null;

  const categories: CategoryBreakdown = {
    greens: computeWeightedAvg(recent30d, (r) => r.greensRating, false),
    fairways: computeWeightedAvg(recent30d, (r) => r.fairwaysRating, false),
    bunkers: computeWeightedAvg(recent30d, (r) => r.bunkersRating, false),
    rough: computeWeightedAvg(recent30d, (r) => r.roughRating, false),
    teeBoxes: computeWeightedAvg(recent30d, (r) => r.teeBoxesRating, false),
  };

  // Trend: compare newer conditions (last 7d or newest report) vs prior baseline (7–45d ago)
  let trend: TrendDirection = 'insufficient';
  let trendDelta: number | null = null;

  if (recent30d.length >= 2) {
    const newerSlice = recent7d.length > 0 ? recent7d : [recent30d[0]];
    const newerIds = new Set(newerSlice);
    const baselineSlice = sorted.filter(
      (r) => !newerIds.has(r) && ageHoursOf(r.createdAt) <= 24 * 45
    );
    if (baselineSlice.length > 0) {
      const newerAvg =
        newerSlice.reduce((s, r) => s + r.overallRating, 0) / newerSlice.length;
      const baselineAvg =
        baselineSlice.reduce((s, r) => s + r.overallRating, 0) / baselineSlice.length;
      trendDelta = round1(newerAvg - baselineAvg);
      if (trendDelta >= 0.4) trend = 'improving';
      else if (trendDelta <= -0.4) trend = 'declining';
      else trend = 'stable';
    }
  }

  // Confidence / Reliability classification
  let confidence: DataConfidence = 'none';
  let confidenceLabel = 'No recent reports';
  let isRankingReliable = false;

  if (recent30d.length === 0) {
    const oldestDays = Math.floor(ageHoursOf(latest.createdAt) / 24);
    confidence = 'stale';
    confidenceLabel = `Outdated · Last reported ${oldestDays}d ago`;
    isRankingReliable = false;
  } else if (recent30d.length === 1) {
    confidence = 'limited';
    confidenceLabel = 'Limited data · 1 recent report';
    isRankingReliable = false;
  } else if (recent30d.length >= 3 && recent7d.length >= 1) {
    confidence = 'high';
    confidenceLabel = `High confidence · ${recent30d.length} recent reports`;
    isRankingReliable = true;
  } else {
    confidence = 'moderate';
    confidenceLabel = `Moderate confidence · ${recent30d.length} recent reports`;
    isRankingReliable = true;
  }

  // Recent agronomy telemetry (from reports within last 21 days)
  const recent21d = sorted.filter((r) => ageHoursOf(r.createdAt) <= 24 * 21);
  const latestSpeed = (recent21d.find((r) => r.greenSpeed)?.greenSpeed ?? null) as GreenSpeed | null;
  const latestFirmness = (recent21d.find((r) => r.firmness)?.firmness ?? null) as SurfaceFirmness | null;
  const latestAeration = (recent21d.find((r) => r.aerationStatus)?.aerationStatus ?? null) as AerationStatus | null;

  const paceEntries = recent30d.map((r) => r.paceMinutes).filter((p): p is number => typeof p === 'number' && p > 60);
  const avgPaceMinutes =
    paceEntries.length > 0
      ? Math.round(paceEntries.reduce((a, b) => a + b, 0) / paceEntries.length)
      : null;

  const recentAerationWarning = recent21d
    .slice(0, 2)
    .some((r) => r.aerationStatus === 'Recently Punched' || r.aerationStatus === 'Healing / Topdressed');

  return {
    currentWeightedRating,
    windowWeightedRating,
    latestRating: round1(latest.overallRating),
    latestReportAt: latest.createdAt,
    historicalAverageRating,
    totalReportCount,
    recent30dReportCount: recent30d.length,
    recent7dReportCount: recent7d.length,
    recent24hReportCount: recent24h.length,
    windowReportCount: windowReports.length,
    trend,
    trendDelta,
    confidence,
    confidenceLabel,
    isRankingReliable,
    categories,
    telemetry: {
      greenSpeed: latestSpeed,
      firmness: latestFirmness,
      aerationStatus: latestAeration,
      avgPaceMinutes,
      recentAerationWarning,
    },
  };
}

/**
 * Haversine great-circle distance in statute miles.
 */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatRelativeAge(isoDate: string | null | undefined, nowMs: number = Date.now()): string {
  if (!isoDate) return 'No reports';
  const diffMs = Math.max(0, nowMs - new Date(isoDate).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatPaceDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return 'Unavailable';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
