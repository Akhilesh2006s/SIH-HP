import mongoose, { Document, Schema } from 'mongoose';

export interface IRewardTransaction extends Document {
  _id: string;
  user_id: string;
  points_change: number;
  transaction_type: 'trip_completed' | 'trip_verified' | 'fraud_penalty' | 'bonus' | 'redemption';
  description: string;
  trip_id?: string;
  timestamp: Date;
  created_at: Date;
  updated_at: Date;
}

const RewardTransactionSchema = new Schema<IRewardTransaction>({
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

export const RewardTransaction = mongoose.model<IRewardTransaction>('RewardTransaction', RewardTransactionSchema);
