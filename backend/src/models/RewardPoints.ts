import mongoose, { Document, Schema } from 'mongoose';

export interface IRewardPoints extends Document {
  _id: string;
  user_id: string;
  points_balance: number;
  last_updated: Date;
  created_at: Date;
  updated_at: Date;
}

const RewardPointsSchema = new Schema<IRewardPoints>({
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

export const RewardPoints = mongoose.model<IRewardPoints>('RewardPoints', RewardPointsSchema);
