import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  color: {
    type: String, // 前端展示用的颜色，比如 '#FF5722'
    default: '#4364F7'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Category', CategorySchema);
