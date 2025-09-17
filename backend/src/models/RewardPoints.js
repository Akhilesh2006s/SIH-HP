const mongoose = require('mongoose');

const RewardPointsSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  points_balance: {
    type: Number,
    required: true,
    default: 0
  },
  last_updated: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('RewardPoints', RewardPointsSchema);

