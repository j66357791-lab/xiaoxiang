import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  color: {
    type: String,
    default: '#4364F7'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Category', CategorySchema);
