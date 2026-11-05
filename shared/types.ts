export type AccessType = 'Public' | 'Municipal' | 'Resort' | 'Semi-Private' | 'Private';

export type CourseStyle =
  | 'Parkland'
  | 'Links'
  | 'Coastal'
  | 'Desert'
  | 'Sandhills'
  | 'Heathland'
  | 'Mountain';

export type GreenSpeed = 'Slow' | 'Medium' | 'Fast' | 'Tournament';
export type SurfaceFirmness = 'Soft' | 'Medium' | 'Firm';
export type AerationStatus = 'None' | 'Healing / Topdressed' | 'Recently Punched';
export type PhotoAreaTag = 'Greens' | 'Fairways' | 'Bunkers' | 'Rough' | 'Tee Boxes' | 'General';

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'insufficient';
export type DataConfidence = 'high' | 'moderate' | 'limited' | 'stale' | 'none';
export type TimeWindowFilter = '24h' | '7d' | '30d' | 'all';

export interface UserPublic {
  id: number;
  name: string;
  username: string;
  email?: string;
  handicap: number | null;
  homeCity: string | null;
  homeState: string | null;
  createdAt: string;
}

export interface ReportPhoto {
  id: number;
  reportId: number;
  courseId: number;
  courseName?: string;
  courseSlug?: string;
  userId: number;
  authorName?: string;
  url: string;
  caption: string | null;
  areaTag: PhotoAreaTag;
  isDemo: boolean;
  createdAt: string;
}

export interface ConditionReport {
  id: number;
  courseId: number;
  courseName?: string;
  courseSlug?: string;
  courseCity?: string;
  courseState?: string;
  userId: number;
  authorName: string;
  authorUsername: string;
  authorHandicap: number | null;
  reportType: 'quick' | 'detailed';
  overallRating: number;
  greensRating: number | null;
  fairwaysRating: number | null;
  bunkersRating: number | null;
  roughRating: number | null;
  teeBoxesRating: number | null;
  greenSpeed: GreenSpeed | null;
  firmness: SurfaceFirmness | null;
  aerationStatus: AerationStatus | null;
  paceMinutes: number | null;
  pinConditionsNote: string | null;
  comment: string | null;
  playedAt: string;
  createdAt: string;
  isDemo: boolean;
  helpfulCount: number;
  viewerHasVotedHelpful?: boolean;
  viewerHasFlagged?: boolean;
  photos: ReportPhoto[];
  weightInCurrentRating?: number;
}

export interface CategoryBreakdown {
  greens: number | null;
  fairways: number | null;
  bunkers: number | null;
  rough: number | null;
  teeBoxes: number | null;
}

export interface TurfTelemetrySummary {
  greenSpeed: GreenSpeed | null;
  firmness: SurfaceFirmness | null;
  aerationStatus: AerationStatus | null;
  avgPaceMinutes: number | null;
  recentAerationWarning: boolean;
}

export interface CourseConditionMetrics {
  currentWeightedRating: number | null;
  windowWeightedRating: number | null;
  latestRating: number | null;
  latestReportAt: string | null;
  historicalAverageRating: number | null;
  totalReportCount: number;
  recent30dReportCount: number;
  recent7dReportCount: number;
  recent24hReportCount: number;
  windowReportCount: number;
  trend: TrendDirection;
  trendDelta: number | null;
  confidence: DataConfidence;
  confidenceLabel: string;
  isRankingReliable: boolean;
  categories: CategoryBreakdown;
  telemetry: TurfTelemetrySummary;
}

export interface OfficialCourseInfo {
  streetAddress: string | null;
  city: string;
  state: string;
  zip: string | null;
  country: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  googleMapsUrl: string;
  accessType: AccessType;
  holes: number | null;
  par: number | null;
  yardage: number | null;
  courseStyle: CourseStyle | null;
  architect: string | null;
  yearBuilt: number | null;
  turfGreens: string | null;
  turfFairways: string | null;
  greenFeeMin: number | null;
  greenFeeMax: number | null;
  greenFeeNotes: string | null;
  amenities: string[] | null;
  officialDescription: string | null;
  dataSource: string;
  verifiedAt: string;
}

export interface CourseSummary {
  id: number;
  slug: string;
  name: string;
  subtitle: string | null;
  regionTag: string;
  official: OfficialCourseInfo;
  metrics: CourseConditionMetrics;
  latestReportSnippet: {
    id: number;
    overallRating: number;
    comment: string | null;
    authorName: string;
    createdAt: string;
    aerationStatus: AerationStatus | null;
    isDemo: boolean;
  } | null;
  isFavorite?: boolean;
  isFollowing?: boolean;
  distanceMiles?: number | null;
}

export interface CourseDetail extends CourseSummary {
  reports: ConditionReport[];
  photos: ReportPhoto[];
}

export interface CourseFollowNotification {
  reportId: number;
  courseId: number;
  courseName: string;
  courseSlug: string;
  overallRating: number;
  authorName: string;
  comment: string | null;
  aerationStatus: AerationStatus | null;
  isDemo: boolean;
  createdAt: string;
  isUnread: boolean;
}
