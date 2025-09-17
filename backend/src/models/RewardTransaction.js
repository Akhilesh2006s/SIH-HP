const mongoose = require('mongoose');

const RewardTransactionSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  points_change: {
    type: Number,
    required: true
  },
  transaction_type: {
    type: String,
    required: true,
    enum: ['trip_completed', 'trip_verified', 'fraud_penalty', 'bonus', 'redemption']
  },
  description: {
    type: String,
    required: true
  },
  trip_id: {
    type: String,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance
RewardTransactionSchema.index({ user_id: 1, timestamp: -1 });
RewardTransactionSchema.index({ transaction_type: 1 });

module.exports = mongoose.model('RewardTransaction', RewardTransactionSchema);

