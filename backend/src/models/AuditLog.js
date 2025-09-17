const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user_id: {
    type: String,
    index: true
  },
  admin_user_id: {
    type: String,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource_type: {
    type: String,
    required: true,
    index: true
  },
  resource_id: {
    type: String,
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ip_address: {
    type: String
  },
  user_agent: {
    type: String
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for audit queries
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ user_id: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, resource_type: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);

