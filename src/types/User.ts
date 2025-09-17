// User and authentication types
export interface User {
  user_id: string; // pseudonymized UUID
  email_hash: string; // hashed email for login
  created_at: string;
  last_login: string;
  is_active: boolean;
  privacy_settings: PrivacySettings;
}

export interface PrivacySettings {
  data_retention_days: number;
  allow_analytics: boolean;
  allow_research: boolean;
  anonymization_level: 'basic' | 'enhanced' | 'maximum';
  export_data: boolean;
  delete_data: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  consent_version: string;
  privacy_settings: Partial<PrivacySettings>;
}

export interface UserProfile {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  timezone: string;
  language: string;
  created_at: string;
  updated_at: string;
}

// Analytics and research data types
export interface AnonymizedTrip {
  trip_id: string;
  zone_origin: string; // aggregated zone
  zone_destination: string; // aggregated zone
  start_time_bin: string; // 5-minute bin
  end_time_bin: string; // 5-minute bin
  duration_seconds: number;
  distance_meters: number;
  travel_mode: string;
  trip_purpose: string;
  num_accompanying: number;
  sensor_summary: {
    average_speed: number;
    plausibility_score: number;
  };
  created_at: string;
}

export interface ODMatrixEntry {
  origin_zone: string;
  destination_zone: string;
  time_bin: string; // 5-minute bin
  trip_count: number;
  total_distance: number;
  total_duration: number;
  mode_share: Record<string, number>;
  created_at: string;
}

export interface HeatmapData {
  zone_id: string;
  lat: number;
  lon: number;
  trip_count: number;
  time_bin: string;
  travel_mode: string;
  created_at: string;
}

export interface TripChainPattern {
  chain_pattern: string; // e.g., "home->work->shopping->home"
  frequency: number;
  average_duration: number;
  average_distance: number;
  created_at: string;
}


