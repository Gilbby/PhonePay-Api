import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  phone: string;
  alias: string;
  pin?: string;
  isAgent: boolean;
  agentCode?: string;
  agentEarnings: number;
  otp?: string;
  otpExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePin(pin: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    alias: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    pin: {
      type: String,
      select: false, // never returned in queries by default
    },
    isAgent: {
      type: Boolean,
      default: false,
    },
    agentCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    agentEarnings: {
      type: Number,
      default: 0,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Hash PIN before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('pin') || !this.pin) return next();
  this.pin = await bcrypt.hash(this.pin, 12);
  next();
});

// Compare PIN method
UserSchema.methods.comparePin = async function (pin: string): Promise<boolean> {
  if (!this.pin) return false;
  return bcrypt.compare(pin, this.pin);
};

export default mongoose.model<IUser>('User', UserSchema);
