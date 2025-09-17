const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  place_name: { type: String },
  accuracy: { type: Number },
  timestamp: { type: Number },
  speed: { type: Number },
  heading: { type: Number }
}, { _id: false });

const TravelModeSchema = new mongoose.Schema({
  detected: { type: String, required: true },
  user_confirmed: { type: String },
  confidence: { type: Number, required: true, min: 0, max: 1 }
}, { _id: false });

const AccompanyingBasicSchema = new mongoose.Schema({
  relation: { type: String, required: true },
  adult_count: { type: Number, required: true, min: 0 },
  child_count: { type: Number, required: true, min: 0 }
}, { _id: false });

const SensorSummarySchema = new mongoose.Schema({
  average_speed: { type: Number, required: true },
  variance_accel: { type: Number, required: true },
  gps_points_count: { type: Number, required: true },
  max_speed: { type: Number, required: true },
  min_speed: { type: Number, required: true },
  total_acceleration: { type: Number, required: true }
}, { _id: false });

const TripSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Trip', TripSchema);

