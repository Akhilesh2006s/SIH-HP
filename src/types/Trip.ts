// Exact trip data model as specified by NATPAC
export interface Location {
  lat: number;
  lon: number;
  place_name: string;
}

export interface TravelMode {
  detected: string;
  user_confirmed: string | null;
  confidence: number;
}

export interface AccompanyingPerson {
  relation: string | null;
  adult_count: number;
  child_count: number;
}

export interface SensorSummary {
  average_speed: number;
  variance_accel: number;
  gps_points_count: number;
  max_speed: number;
  min_speed: number;
  total_acceleration: number;
}

export interface Trip {
  trip_id: string; // UUID
  user_id: string; // pseudonymized id, not raw email
  trip_number: number; // sequence of trips per day
  chain_id: string; // UUID - groups trips that form a chain
  origin: Location;
  destination: Location;
  start_time: string; // ISO8601
  end_time: string; // ISO8601
  duration_seconds: number;
  distance_meters: number;
  travel_mode: TravelMode;
  trip_purpose: string; // user-selected from taxonomy + 'other' text
  num_accompanying: number;
  accompanying_basic: AccompanyingPerson[];
  notes?: string; // optional text
  sensor_summary: SensorSummary;
  recorded_offline: boolean;
  synced: boolean;
  created_at: string; // ISO8601
  updated_at: string; // ISO8601
  is_private?: boolean; // do not sync to server
  plausibility_score?: number; // 0-100 for fraud detection
}

export interface TripChain {
  chain_id: string;
  user_id: string;
  trips: Trip[];
  start_time: string;
  end_time: string;
  total_distance: number;
  total_duration: number;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  background_tracking_enabled: boolean;
  sync_frequency_minutes: number;
  battery_optimization: boolean;
  privacy_mode: boolean;
  reward_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsentRecord {
  user_id: string;
  consent_version: string;
  background_tracking_consent: boolean;
  data_sharing_consent: boolean;
  analytics_consent: boolean;
  consent_timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

export interface RewardPoints {
  user_id: string;
  total_points: number;
  available_points: number;
  redeemed_points: number;
  last_earned: string;
  created_at: string;
  updated_at: string;
}

export interface RewardTransaction {
  transaction_id: string;
  user_id: string;
  trip_id?: string;
  points_earned: number;
  points_redeemed: number;
  transaction_type: 'trip_completion' | 'correction' | 'redemption' | 'bonus' | 'penalty';
  description: string;
  created_at: string;
}

// Trip purpose taxonomy
export const TRIP_PURPOSES = [
  'work',
  'education',
  'shopping',
  'healthcare',
  'recreation',
  'social',
  'personal_business',
  'home',
  'other'
] as const;

export type TripPurpose = typeof TRIP_PURPOSES[number];

// Travel modes
export const TRAVEL_MODES = [
  'walking',
  'cycling',
  'public_transport',
  'private_vehicle',
  'taxi_rideshare',
  'other'
] as const;

export type TravelModeType = typeof TRAVEL_MODES[number];

// Accompanying person relations
export const ACCOMPANYING_RELATIONS = [
  'family',
  'friend',
  'colleague',
  'stranger',
  'alone',
  'other'
] as const;

export type AccompanyingRelation = typeof ACCOMPANYING_RELATIONS[number];
