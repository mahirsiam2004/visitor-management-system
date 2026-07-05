import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IGuestPassDocument extends Document {
  residentId: Types.ObjectId;
  guestName: string;
  guestPhone: string;
  purpose: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  guestId: string;
  qrToken: string;
  expiresAt: Date;
  status: 'active' | 'expired' | 'inside' | 'completed';
  entryTime?: Date;
  exitTime?: Date;
  createdAt: Date;
}

const GuestPassSchema = new Schema<IGuestPassDocument>(
  {
    residentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Resident ID is required'],
    },
    guestName: {
      type: String,
      required: [true, 'Guest name is required'],
      trim: true,
    },
    guestPhone: {
      type: String,
      required: [true, 'Guest phone is required'],
      trim: true,
    },
    purpose: {
      type: String,
      required: [true, 'Purpose of visit is required'],
      trim: true,
    },
    visitDate: {
      type: String,
      required: [true, 'Visit date is required'],
    },
    visitTime: {
      type: String,
      required: [true, 'Visit time is required'],
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: 1,
      max: 24,
    },
    guestId: {
      type: String,
      required: true,
      unique: true,
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'inside', 'completed'],
      default: 'active',
    },
    entryTime: {
      type: Date,
    },
    exitTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
GuestPassSchema.index({ residentId: 1, createdAt: -1 });
GuestPassSchema.index({ qrToken: 1 }, { unique: true });
GuestPassSchema.index({ status: 1 });
GuestPassSchema.index({ expiresAt: 1 });

// Auto-expire: update status to 'expired' if past expiry and still 'active'
GuestPassSchema.pre('find', function () {
  this.where({ expiresAt: { $gt: new Date() }, status: 'active' });
});

const GuestPass: Model<IGuestPassDocument> =
  mongoose.models.GuestPass ||
  mongoose.model<IGuestPassDocument>('GuestPass', GuestPassSchema);

export default GuestPass;
