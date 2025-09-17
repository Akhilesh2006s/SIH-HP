const mongoose = require('mongoose');

const ConsentRecordSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  consent_version: {
    type: String,
    required: true
  },
  background_tracking_consent: {
    type: Boolean,
    required: true
  },
  data_sharing_consent: {
    type: Boolean,
    required: true
  },
  analytics_consent: {
    type: Boolean,
    required: true
  },
  consent_timestamp: {
    type: Date,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for user consent queries
ConsentRecordSchema.index({ user_id: 1, consent_timestamp: -1 });

module.exports = mongoose.model('ConsentRecord', ConsentRecordSchema);

