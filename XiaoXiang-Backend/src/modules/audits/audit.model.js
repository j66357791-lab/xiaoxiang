import mongoose from 'mongoose';

const AuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentRank: {
    type: Number,
    required: true
  },
  targetRank: {
    type: Number,
    required: true
  },
  validDirectCount: {
    type: Number,
    default: 0
  },
  validTeamCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reason: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

export default mongoose.model('Audit', AuditSchema);
