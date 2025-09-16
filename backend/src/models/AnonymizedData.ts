import mongoose, { Document, Schema } from 'mongoose';

export interface IAnonymizedData extends Document {
  _id: string;
  pseudonymized_user_id: string;
  origin_zone: string;
  destination_zone: string;
  start_time_bucket: string;
  end_time_bucket: string;
  duration_bucket: string;
  distance_bucket: string;
  travel_mode: string;
  trip_purpose: string;
  num_accompanying_bucket: string;
  created_at: Date;
  updated_at: Date;
}

const AnonymizedDataSchema = new Schema<IAnonymizedData>({
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

export const AnonymizedData = mongoose.model<IAnonymizedData>('AnonymizedData', AnonymizedDataSchema);
