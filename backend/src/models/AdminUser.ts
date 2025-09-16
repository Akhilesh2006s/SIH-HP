import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminUser extends Document {
  _id: string;
  username: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

const AdminUserSchema = new Schema<IAdminUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: true
  },
  salt: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'super_admin'],
    default: 'admin'
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_login: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const AdminUser = mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);