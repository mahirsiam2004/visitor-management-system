import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IEntryLogDocument extends Document {
  guestPass: Types.ObjectId;
  securityGuard: Types.ObjectId;
  checkIn: Date;
  checkOut?: Date;
}

const EntryLogSchema = new Schema<IEntryLogDocument>(
  {
    guestPass: {
      type: Schema.Types.ObjectId,
      ref: 'GuestPass',
      required: [true, 'Guest pass reference is required'],
    },
    securityGuard: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Security guard reference is required'],
    },
    checkIn: {
      type: Date,
      required: [true, 'Check-in time is required'],
      default: Date.now,
    },
    checkOut: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for admin lookups
EntryLogSchema.index({ guestPass: 1 });
EntryLogSchema.index({ securityGuard: 1 });
EntryLogSchema.index({ checkIn: -1 });

const EntryLog: Model<IEntryLogDocument> =
  mongoose.models.EntryLog ||
  mongoose.model<IEntryLogDocument>('EntryLog', EntryLogSchema);

export default EntryLog;
