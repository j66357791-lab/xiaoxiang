import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema({
  // 公告标题
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // 公告类型: text | image
  type: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  
  // 文字内容
  content: {
    type: String,
    default: '',
    maxlength: 5000
  },
  
  // 图片URL
  imageUrl: {
    type: String,
    default: ''
  },
  
  // 是否启用
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 文字样式 - 加粗
  isBold: {
    type: Boolean,
    default: false
  },
  
  // 文字样式 - 居中
  isCenter: {
    type: Boolean,
    default: false
  },
  
  // 创建者
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // 阅读次数
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
AnnouncementSchema.index({ isActive: 1, createdAt: -1 });

const Announcement = mongoose.model('Announcement', AnnouncementSchema);

export default Announcement;
