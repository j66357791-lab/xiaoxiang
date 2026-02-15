import mongoose from 'mongoose';

const TaskTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  color: {
    type: String,
    default: '#FF9800'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('TaskType', TaskTypeSchema);
