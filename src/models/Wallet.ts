import mongoose, { Document, Schema } from 'mongoose';

export type WalletProvider = 'MTN' | 'Airtel' | 'Zamtel';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  phone: string;
  provider: WalletProvider;
  isPrimary: boolean;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['MTN', 'Airtel', 'Zamtel'],
      required: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    balance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IWallet>('Wallet', WalletSchema);
