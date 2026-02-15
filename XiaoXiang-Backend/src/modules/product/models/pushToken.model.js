import mongoose from 'mongoose';

const PushTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  token: { type: String, required: true }, // Expo Push Token
  platform: { type: String },
}, { timestamps: true });

export default mongoose.model('PushToken', PushTokenSchema);
