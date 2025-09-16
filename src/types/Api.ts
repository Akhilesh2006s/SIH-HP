// API request/response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Auth API types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    user_id: string;
    email_hash: string;
    created_at: string;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  };
}

export interface SignupRequest {
  email: string;
  password: string;
  consent_version: string;
  privacy_settings: {
    data_retention_days: number;
    allow_analytics: boolean;
    allow_research: boolean;
    anonymization_level: 'basic' | 'enhanced' | 'maximum';
  };
}

// Trip API types
export interface TripSyncRequest {
  trips: Array<{
    trip_id: string;
    encrypted_data: string; // client-side encrypted trip data
    signature: string; // HMAC signature for integrity
  }>;
  sync_timestamp: string;
}

export interface TripSyncResponse {
  synced_trips: string[]; // trip_ids that were successfully synced
  failed_trips: Array<{
    trip_id: string;
    error: string;
  }>;
  server_timestamp: string;
}

export interface TripCorrectionRequest {
  trip_id: string;
  corrections: {
    travel_mode?: string;
    trip_purpose?: string;
    notes?: string;
    is_private?: boolean;
  };
}

// Analytics API types
export interface ODMatrixRequest {
  start_date: string;
  end_date: string;
  time_bins?: string[]; // e.g., ['08:00-09:00', '17:00-18:00']
  zones?: string[]; // specific zones to include
  travel_modes?: string[];
}

export interface HeatmapRequest {
  start_date: string;
  end_date: string;
  time_bins?: string[];
  travel_modes?: string[];
  aggregation_level: 'zone' | 'grid_100m' | 'grid_500m';
}

export interface TripChainAnalysisRequest {
  start_date: string;
  end_date: string;
  min_frequency?: number; // minimum frequency to include pattern
  max_pattern_length?: number; // maximum chain length
}

// Data export/delete types
export interface DataExportRequest {
  format: 'json' | 'csv' | 'encrypted';
  include_sensitive: boolean;
  date_range?: {
    start_date: string;
    end_date: string;
  };
}

export interface DataExportResponse {
  export_id: string;
  download_url: string;
  expires_at: string;
  file_size: number;
}

export interface DataDeleteRequest {
  confirmation_token: string;
  delete_all: boolean;
  date_range?: {
    start_date: string;
    end_date: string;
  };
}

// Admin API types
export interface AnonymizationRequest {
  start_date: string;
  end_date: string;
  anonymization_level: 'basic' | 'enhanced' | 'maximum';
  aggregation_zones: string[];
  time_bin_size: number; // minutes
}

export interface AnonymizationResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimated_completion: string;
  records_processed: number;
}

// Webhook types for real-time updates
export interface WebhookEvent {
  event_type: 'trip_synced' | 'user_consent_updated' | 'data_exported' | 'anonymization_completed';
  user_id: string;
  data: any;
  timestamp: string;
  signature: string;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export const API_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  SYNC_CONFLICT: 'SYNC_CONFLICT'
} as const;
