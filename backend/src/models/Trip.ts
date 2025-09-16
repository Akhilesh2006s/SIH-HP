import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation {
  lat: number;
  lon: number;
  place_name?: string;
  accuracy?: number;
  timestamp?: number;
  speed?: number;
  heading?: number;
}

export interface ITravelMode {
  detected: string;
  user_confirmed?: string;
  confidence: number;
}

export interface IAccompanyingBasic {
  relation: string;
  adult_count: number;
  child_count: number;
}

export interface ISensorSummary {
  average_speed: number;
  variance_accel: number;
  gps_points_count: number;
  max_speed: number;
  min_speed: number;
  total_acceleration: number;
}

export interface ITrip extends Document {
  _id: string;
  trip_id: string;
  user_id: string;
  trip_number: number;
  chain_id: string;
  origin: ILocation;
  destination: ILocation;
  start_time: Date;
  end_time: Date;
  duration_seconds: number;
  distance_meters: number;
  travel_mode: ITravelMode;
  trip_purpose: string;
  num_accompanying: number;
  accompanying_basic: IAccompanyingBasic[];
  notes?: string;
  sensor_summary: ISensorSummary;
  recorded_offline: boolean;
  synced: boolean;
  is_private: boolean;
  plausibility_score: number;
  anonymized_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const LocationSchema = new Schema<ILocation>({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  place_name: { type: String },
  accuracy: { type: Number },
  timestamp: { type: Number },
  speed: { type: Number },
  heading: { type: Number }
}, { _id: false });

const TravelModeSchema = new Schema<ITravelMode>({
  detected: { type: String, required: true },
  user_confirmed: { type: String },
  confidence: { type: Number, required: true, min: 0, max: 1 }
}, { _id: false });

const AccompanyingBasicSchema = new Schema<IAccompanyingBasic>({
  relation: { type: String, required: true },
  adult_count: { type: Number, required: true, min: 0 },
  child_count: { type: Number, required: true, min: 0 }
}, { _id: false });

const SensorSummarySchema = new Schema<ISensorSummary>({
  average_speed: { type: Number, required: true },
  variance_accel: { type: Number, required: true },
  gps_points_count: { type: Number, required: true },
  max_speed: { type: Number, required: true },
  min_speed: { type: Number, required: true },
  total_acceleration: { type: Number, required: true }
}, { _id: false });

const TripSchema = new Schema<ITrip>({
  trip_id: {
    type: String,
    required: true,
    unique: true
  },
  user_id: {
    type: String,
    required: true,
    index: true
  },
  trip_number: {
    type: Number,
    required: true
  },
  chain_id: {
    type: String,
    required: true,
    index: true
  },
  origin: {
    type: LocationSchema,
    required: true
  },
  destination: {
    type: LocationSchema,
    required: true
  },
  start_time: {
    type: Date,
    required: true,
    index: true
  },
  end_time: {
    type: Date,
    required: true
  },
  duration_seconds: {
    type: Number,
    required: true
  },
  distance_meters: {
    type: Number,
    required: true
  },
  travel_mode: {
    type: TravelModeSchema,
    required: true
  },
  trip_purpose: {
    type: String,
    required: true
  },
  num_accompanying: {
    type: Number,
    required: true,
    min: 0
  },
  accompanying_basic: {
    type: [AccompanyingBasicSchema],
    default: []
  },
  notes: {
    type: String
  },
  sensor_summary: {
    type: SensorSummarySchema,
    required: true
  },
  recorded_offline: {
    type: Boolean,
    default: false
  },
  synced: {
    type: Boolean,
    default: false
  },
  is_private: {
    type: Boolean,
    default: false
  },
  plausibility_score: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  anonymized_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance
TripSchema.index({ user_id: 1, start_time: -1 });
TripSchema.index({ chain_id: 1 });
TripSchema.index({ start_time: 1, end_time: 1 });
TripSchema.index({ 'origin.lat': 1, 'origin.lon': 1 });
TripSchema.index({ 'destination.lat': 1, 'destination.lon': 1 });
TripSchema.index({ travel_mode: 1 });
TripSchema.index({ synced: 1, anonymized_at: 1 });

export const Trip = mongoose.model<ITrip>('Trip', TripSchema);
