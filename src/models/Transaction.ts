import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'sent' | 'received' | 'cash_out';
export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface ITransaction extends Document {
  type: TransactionType;
  amount: number;
  fee: number;
  status: TransactionStatus;
  senderId: mongoose.Types.ObjectId;
  receiverId?: mongoose.Types.ObjectId;
  senderWalletId?: mongoose.Types.ObjectId;
  receiverWalletId?: mongoose.Types.ObjectId;
  agentId?: mongoose.Types.ObjectId;
  reference: string;
  note?: string;
  depositId?: string;
  payoutId?: string;
  depositStatus?: TransactionStatus;
  payoutStatus?: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    type: {
      type: String,
      enum: ['sent', 'received', 'cash_out'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    fee: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    senderWalletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
    },
    receiverWalletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    note: {
      type: String,
      trim: true,
    },
    depositId: { type: String },
    payoutId: { type: String },
    depositStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    payoutStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
