import mongoose from 'mongoose';

const GiftPackSchema = new mongoose.Schema({
  // 礼包ID
  giftId: {
    type: String,
    required: true,
    unique: true,
  },
  // 礼包名称
  name: {
    type: String,
    required: true,
  },
  // 价格（元）
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  // 奖励配置
  rewards: [{
    points: { type: Number, required: true },
    probability: { type: Number, required: true }, // 概率百分比
    label: { type: String, required: true },
  }],
  // 总库存
  totalStock: {
    type: Number,
    required: true,
    default: 0,
  },
  // 已售数量
  soldCount: {
    type: Number,
    default: 0,
  },
  // 状态
  status: {
    type: String,
    enum: ['available', 'sold_out', 'offline'],
    default: 'available',
  },
  // 每人限购数量
  purchaseLimit: {
    type: Number,
    default: 1,
  },
  // 有效期
  expireAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// 索引
GiftPackSchema.index({ giftId: 1 });
GiftPackSchema.index({ status: 1 });

export default mongoose.model('GiftPack', GiftPackSchema);
