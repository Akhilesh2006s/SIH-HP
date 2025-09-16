import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  _id: string;
  user_id?: string;
  admin_user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: any;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
  created_at: Date;
  updated_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
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
    type: Schema.Types.Mixed,
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

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
