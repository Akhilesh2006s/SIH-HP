// App configuration constants
export const APP_CONFIG = {
  // App info
  APP_NAME: 'Smart Travel Diary',
  APP_VERSION: '1.0.0',
  CONSENT_VERSION: '1.0.0',
  
  // API configuration
  API_BASE_URL: __DEV__ ? 'http://localhost:3000/api' : 'https://your-backend-url.com/api',
  API_TIMEOUT: 30000, // 30 seconds
  
  // Location tracking
  LOCATION_ACCURACY: 6, // meters
  LOCATION_TIMEOUT: 10000, // 10 seconds
  LOCATION_MAX_AGE: 60000, // 1 minute
  BACKGROUND_LOCATION_INTERVAL: 30000, // 30 seconds
  MIN_TRIP_DISTANCE: 50, // meters
  MIN_TRIP_DURATION: 60, // seconds
  DWELL_TIME_THRESHOLD: 300, // 5 minutes
  
  // Trip detection
  SPEED_THRESHOLDS: {
    WALKING: 1.5, // m/s
    CYCLING: 3.0, // m/s
    VEHICLE: 5.0, // m/s
  },
  ACCELERATION_THRESHOLD: 0.5, // m/s²
  
  // Sync configuration
  SYNC_BATCH_SIZE: 50,
  SYNC_RETRY_ATTEMPTS: 3,
  SYNC_RETRY_DELAY: 5000, // 5 seconds
  OFFLINE_QUEUE_SIZE: 1000,
  
  // Privacy settings
  DEFAULT_DATA_RETENTION_DAYS: 365,
  MIN_ANONYMIZATION_THRESHOLD: 5, // minimum trips per zone
  TIME_BIN_SIZE: 5, // minutes
  SPATIAL_GRID_SIZE: 100, // meters
  
  // Rewards
  POINTS_PER_TRIP: 10,
  POINTS_PER_CORRECTION: 5,
  BONUS_POINTS_WEEKLY: 50,
  BONUS_POINTS_MONTHLY: 200,
  
  // Battery optimization
  BATTERY_SAVER_MODE: 0.2, // 20% battery
  REDUCED_SAMPLING_BATTERY: 0.1, // 10% battery
  MIN_BATTERY_FOR_TRACKING: 0.05, // 5% battery
} as const;

export const PRIVACY_LEVELS = {
  BASIC: {
    time_aggregation: 15, // 15-minute bins
    spatial_aggregation: 500, // 500m grid
    data_retention: 90, // days
  },
  ENHANCED: {
    time_aggregation: 30, // 30-minute bins
    spatial_aggregation: 1000, // 1km grid
    data_retention: 180, // days
  },
  MAXIMUM: {
    time_aggregation: 60, // 1-hour bins
    spatial_aggregation: 2000, // 2km grid
    data_retention: 365, // days
  },
} as const;

export const ZONE_DEFINITIONS = {
  // Example zone definitions - should be configurable
  HOME: 'home_zone',
  WORK: 'work_zone',
  EDUCATION: 'education_zone',
  SHOPPING: 'shopping_zone',
  HEALTHCARE: 'healthcare_zone',
  RECREATION: 'recreation_zone',
  OTHER: 'other_zone',
} as const;

export const NOTIFICATION_TYPES = {
  TRIP_DETECTED: 'trip_detected',
  TRIP_CONFIRMATION: 'trip_confirmation',
  SYNC_COMPLETED: 'sync_completed',
  REWARD_EARNED: 'reward_earned',
  BATTERY_LOW: 'battery_low',
  PRIVACY_REMINDER: 'privacy_reminder',
} as const;
