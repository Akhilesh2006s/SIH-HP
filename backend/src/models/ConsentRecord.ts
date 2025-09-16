import mongoose, { Document, Schema } from 'mongoose';

export interface IConsentRecord extends Document {
  _id: string;
  user_id: string;
  consent_version: string;
  background_tracking_consent: boolean;
  data_sharing_consent: boolean;
  analytics_consent: boolean;
  consent_timestamp: Date;
  created_at: Date;
  updated_at: Date;
}

const ConsentRecordSchema = new Schema<IConsentRecord>({
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

export const ConsentRecord = mongoose.model<IConsentRecord>('ConsentRecord', ConsentRecordSchema);
