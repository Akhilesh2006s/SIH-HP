const mongoose = require('mongoose');

const AnonymizedDataSchema = new mongoose.Schema({
  pseudonymized_user_id: {
    type: String,
    required: true,
    index: true
  },
  origin_zone: {
    type: String,
    required: true,
    index: true
  },
  destination_zone: {
    type: String,
    required: true,
    index: true
  },
  start_time_bucket: {
    type: String,
    required: true,
    index: true
  },
  end_time_bucket: {
    type: String,
    required: true
  },
  duration_bucket: {
    type: String,
    required: true
  },
  distance_bucket: {
    type: String,
    required: true
  },
  travel_mode: {
    type: String,
    required: true,
    index: true
  },
  trip_purpose: {
    type: String,
    required: true
  },
  num_accompanying_bucket: {
    type: String,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for analytics queries
AnonymizedDataSchema.index({ origin_zone: 1, destination_zone: 1 });
AnonymizedDataSchema.index({ start_time_bucket: 1 });
AnonymizedDataSchema.index({ travel_mode: 1 });
AnonymizedDataSchema.index({ created_at: 1 });

module.exports = mongoose.model('AnonymizedData', AnonymizedDataSchema);

