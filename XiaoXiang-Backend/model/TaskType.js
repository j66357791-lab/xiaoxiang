import mongoose from 'mongoose';

const TaskTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  color: {
    type: String, // 前端展示用的颜色，比如 '#FF9800'
    default: '#FF9800'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('TaskType', TaskTypeSchema);
