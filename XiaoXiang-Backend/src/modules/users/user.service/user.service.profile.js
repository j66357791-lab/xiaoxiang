/**
 * 用户服务 - 个人资料修改模块
 * 包含：改名审核、异步队列、频率限制、重名检查
 * 
 * 审核流程：
 * 1. 用户申请修改名字 -> 进入队列
 * 2. 先进行本地词库审核（敏感词检测）
 *    - 如果包含敏感词 -> 直接打回
 *    - 如果通过 -> 进入AI审核队列
 * 3. AI审核队列处理逻辑：
 *    - 每小时处理一次
 *    - 如果5分钟内没有新增排队申请，就直接审核
 *    - 如果一直有新申请，就继续排队
 */
import User from '../user.model.js';
import { BadRequestError, NotFoundError } from '../../../common/utils/error.js';
import axios from 'axios';

// ==========================================
// 配置常量
// ==========================================
const CONFIG = {
  // AI审核间隔时间（毫秒）- 每小时
  AI_REVIEW_INTERVAL: 60 * 60 * 1000,
  // 空闲触发时间（毫秒）- 5分钟无新增
  IDLE_TRIGGER_TIME: 5 * 60 * 1000,
  // 队列处理间隔（毫秒）
  QUEUE_PROCESS_INTERVAL: 1000,
  // 冷却时间（小时）
  COOLDOWN_HOURS: 24,
  // 昵称长度限制
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 12,
};

// ==========================================
// 本地敏感词库
// ==========================================
const SENSITIVE_WORDS = {
  // 一级敏感词（直接打回，无需AI审核）
  level1: [
    // 政治类
    '习近平', '江泽民', '胡锦涛', '温家宝', '李克强', '党中央', '国务院',
    '反动', '颠覆', '分裂国家', '台独', '藏独', '疆独',
    // 违法类
    '毒品', '贩毒', '吸毒', '赌博', '洗钱', '诈骗', '传销',
    // 职务冒充类
    '管理员', '官方', '客服', 'admin', 'Admin', 'ADMIN',
    '系统', 'system', 'System', 'SYSTEM', '版主', 'moderator',
    // 极端词汇
    '恐怖', '爆炸', '杀人', '自杀',
  ],
  // 二级敏感词（需要AI进一步审核，标记为重点关注）
  level2: [
    // 不雅词汇
    '傻', '蠢', '笨', '贱', '滚', '靠', '操', '日', '草',
    'fuck', 'shit', 'damn', 'ass', 'bitch',
    // 敏感话题
    '色情', '暴力', '血腥', '恶心',
    // 特殊符号组合
    'vip', 'VIP', 'Vip',
  ]
};

// ==========================================
// 审核队列状态管理（单例）
// ==========================================
class NameReviewQueue {
  constructor() {
    // AI审核队列
    this.aiReviewQueue = [];
    // 队列是否正在处理
    this.isProcessing = false;
    // 上次入队时间（用于判断空闲触发）
    this.lastEnqueueTime = null;
    // 上次AI审核时间（用于判断定时触发）
    this.lastAiReviewTime = null;
    // 空闲检测定时器
    this.idleTimer = null;
    // 定时审核定时器
    this.scheduleTimer = null;
    // 初始化
    this.init();
  }

  /**
   * 初始化定时任务
   */
  init() {
    // 启动定时审核（每小时一次）
    this.startScheduledReview();
    // 启动空闲检测（5分钟无新增触发）
    this.startIdleDetection();
    // 记录初始化时间
    this.lastAiReviewTime = Date.now();
    console.log('[审核队列] 初始化完成');
  }

  /**
   * 启动定时审核（每小时一次）
   */
  startScheduledReview() {
    // 清除旧的定时器
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
    }
    
    // 每分钟检查一次是否到达一小时
    this.scheduleTimer = setInterval(() => {
      this.checkScheduledReview();
    }, 60 * 1000);
  }

  /**
   * 检查是否需要定时审核
   */
  checkScheduledReview() {
    const now = Date.now();
    const timeSinceLastReview = now - (this.lastAiReviewTime || 0);
    
    // 如果距离上次审核已超过一小时，且队列不为空
    if (timeSinceLastReview >= CONFIG.AI_REVIEW_INTERVAL && this.aiReviewQueue.length > 0) {
      console.log('[审核队列] 定时触发：已满一小时，开始处理队列');
      this.processQueue();
    }
  }

  /**
   * 启动空闲检测（5分钟无新增则触发）
   */
  startIdleDetection() {
    // 清除旧的定时器
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
    }
    
    // 每分钟检查一次
    this.idleTimer = setInterval(() => {
      this.checkIdleTrigger();
    }, 60 * 1000);
  }

  /**
   * 检查是否需要空闲触发
   */
  checkIdleTrigger() {
    if (!this.lastEnqueueTime || this.aiReviewQueue.length === 0) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastEnqueue = now - this.lastEnqueueTime;
    
    // 如果距离上次入队已超过5分钟，且队列不为空
    if (timeSinceLastEnqueue >= CONFIG.IDLE_TRIGGER_TIME) {
      console.log('[审核队列] 空闲触发：5分钟无新增，开始处理队列');
      this.processQueue();
    }
  }

  /**
   * 本地词库审核
   * @param {string} name - 待审核昵称
   * @returns {Object} { passed: boolean, level: number, reason: string }
   */
  localWordCheck(name) {
    const lowerName = name.toLowerCase();
    
    // 检查一级敏感词（直接打回）
    for (const word of SENSITIVE_WORDS.level1) {
      if (lowerName.includes(word.toLowerCase())) {
        return {
          passed: false,
          level: 1,
          reason: '昵称包含敏感词汇，无法使用'
        };
      }
    }
    
    // 检查二级敏感词（标记需要AI重点审核）
    let needsAiFocus = false;
    for (const word of SENSITIVE_WORDS.level2) {
      if (lowerName.includes(word.toLowerCase())) {
        needsAiFocus = true;
        break;
      }
    }
    
    return {
      passed: true,
      level: needsAiFocus ? 2 : 0, // 0表示通过本地审核，2表示需要AI重点审核
      reason: needsAiFocus ? '需要AI进一步审核' : '本地审核通过'
    };
  }

  /**
   * 添加到AI审核队列
   * @param {Object} task - 任务对象 { userId, newName, needsFocus }
   */
  enqueue(task) {
    this.aiReviewQueue.push(task);
    this.lastEnqueueTime = Date.now();
    console.log(`[审核队列] 新任务入队: userId=${task.userId}, newName=${task.newName}, 当前队列长度=${this.aiReviewQueue.length}`);
  }

  /**
   * 处理审核队列
   */
  async processQueue() {
    if (this.isProcessing || this.aiReviewQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    console.log(`[审核队列] 开始处理，当前队列长度: ${this.aiReviewQueue.length}`);
    
    await this.processNextItem();
  }

  /**
   * 处理队列中的下一个任务
   */
  async processNextItem() {
    if (this.aiReviewQueue.length === 0) {
      this.isProcessing = false;
      this.lastAiReviewTime = Date.now();
      console.log('[审核队列] 队列处理完成');
      return;
    }
    
    const task = this.aiReviewQueue.shift();
    console.log(`[审核队列] 处理任务: userId=${task.userId}, newName=${task.newName}`);
    
    try {
      const user = await User.findById(task.userId);
      
      // 二次校验状态
      if (!user || user.nameStatus !== 'pending') {
        console.log(`[审核队列] 用户状态已变更，跳过: userId=${task.userId}`);
        setTimeout(() => this.processNextItem(), CONFIG.QUEUE_PROCESS_INTERVAL);
        return;
      }
      
      // 调用AI审核
      const aiResult = await this.aiReview(task.newName, task.needsFocus);
      
      if (aiResult.safe) {
        // 再次查重（防止审核期间被抢注）
        const duplicate = await User.findOne({
          name: task.newName,
          _id: { $ne: user._id }
        });
        
        if (duplicate) {
          await this.updateStatus(user._id, 'rejected', null, '该昵称已被抢占');
          console.log(`[审核队列] 昵称被抢占: userId=${task.userId}`);
        } else {
          // 审核通过 -> 更新正式名字
          await User.findByIdAndUpdate(user._id, {
            $set: {
              name: task.newName,
              nameStatus: 'approved',
              pendingName: null,
              nameUpdatedAt: new Date()
            }
          });
          console.log(`[审核队列] 审核通过: userId=${task.userId}, newName=${task.newName}`);
        }
      } else {
        // 审核拒绝
        await this.updateStatus(user._id, 'rejected', null, aiResult.reason);
        console.log(`[审核队列] 审核拒绝: userId=${task.userId}, reason=${aiResult.reason}`);
      }
      
    } catch (err) {
      console.error(`[审核队列] 处理异常: userId=${task.userId}, error=${err.message}`);
      await this.updateStatus(
        task.userId,
        'rejected',
        null,
        '审核服务异常，请稍后重试'
      );
    } finally {
      // 间隔处理下一个
      setTimeout(() => this.processNextItem(), CONFIG.QUEUE_PROCESS_INTERVAL);
    }
  }

  /**
   * AI内容安全审核
   * @param {string} text - 待审核文本
   * @param {boolean} needsFocus - 是否需要重点审核
   * @returns {Object} { safe: boolean, reason?: string }
   */
  async aiReview(text, needsFocus = false) {
    const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
    
    // 如果没配置 key，默认通过（依赖本地词库）
    if (!ZHIPU_API_KEY) {
      console.log('[AI审核] 未配置API密钥，默认通过');
      return { safe: true };
    }
    
    try {
      console.log(`[AI审核] 开始审核: text=${text}, needsFocus=${needsFocus}`);
      
      const response = await axios.post(
        'https://open.bigmodel.cn/api/paas/v4/moderations',
        { model: 'moderation', input: text },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ZHIPU_API_KEY}`,
          },
          timeout: 10000, // 10秒超时
        }
      );
      
      const result = response.data?.result_list?.[0];
      
      if (!result) {
        return { safe: false, reason: '审核服务异常，请稍后再试' };
      }
      
      // risk_level: PASS / REVIEW / REJECT
      if (result.risk_level === 'REJECT') {
        return { safe: false, reason: '昵称内容违规，请修改' };
      }
      
      // 如果需要重点审核，REVIEW级别也拒绝
      if (needsFocus && result.risk_level === 'REVIEW') {
        return { safe: false, reason: '昵称内容疑似违规，请修改' };
      }
      
      console.log(`[AI审核] 审核完成: risk_level=${result.risk_level}`);
      return { safe: true };
      
    } catch (err) {
      console.error(`[AI审核] 调用失败: ${err.message}`);
      return { safe: false, reason: '审核服务暂时不可用，请稍后再试' };
    }
  }

  /**
   * 更新审核状态
   */
  async updateStatus(userId, status, pendingName, reason) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        nameStatus: status,
        pendingName: pendingName,
        nameRejectReason: reason
      }
    });
  }

  /**
   * 获取队列状态（用于监控）
   */
  getStatus() {
    return {
      queueLength: this.aiReviewQueue.length,
      isProcessing: this.isProcessing,
      lastEnqueueTime: this.lastEnqueueTime,
      lastAiReviewTime: this.lastAiReviewTime,
      nextScheduledReview: this.lastAiReviewTime 
        ? new Date(this.lastAiReviewTime + CONFIG.AI_REVIEW_INTERVAL) 
        : null,
      timeUntilIdleTrigger: this.lastEnqueueTime
        ? Math.max(0, CONFIG.IDLE_TRIGGER_TIME - (Date.now() - this.lastEnqueueTime))
        : null,
    };
  }
}

// 单例模式
const nameReviewQueue = new NameReviewQueue();

// ==========================================
// 导出服务类
// ==========================================
export class UserServiceProfile {
  /**
   * 获取改名状态
   * @param {string} userId - 用户ID
   * @returns {Object} 改名状态信息
   */
  static async getNameStatus(userId) {
    const user = await User.findById(userId).select(
      'name nameStatus pendingName nameRejectReason nameUpdatedAt'
    );
    
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    return {
      currentName: user.name,
      status: user.nameStatus || 'idle',
      pendingName: user.pendingName,
      rejectReason: user.nameRejectReason,
      lastUpdatedAt: user.nameUpdatedAt
    };
  }

  /**
   * 提交改名申请
   * 流程：
   * 1. 基础验证（长度、频率、重名）
   * 2. 本地词库审核 -> 敏感词直接打回
   * 3. 通过本地审核 -> 进入AI审核队列
   * @param {string} userId - 用户ID
   * @param {string} newName - 新昵称
   * @returns {Object} 提交结果
   */
  static async requestNameChange(userId, newName) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const trimmedName = newName.trim();

    // 1. 长度验证
    if (trimmedName.length < CONFIG.NAME_MIN_LENGTH || trimmedName.length > CONFIG.NAME_MAX_LENGTH) {
      throw new BadRequestError(`昵称长度需在${CONFIG.NAME_MIN_LENGTH}-${CONFIG.NAME_MAX_LENGTH}个字符之间`);
    }

    // 2. 频率限制检查（24小时冷却）
    if (user.nameUpdatedAt) {
      const lastUpdate = new Date(user.nameUpdatedAt).getTime();
      const now = Date.now();
      const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);
      if (hoursDiff < CONFIG.COOLDOWN_HOURS) {
        const remaining = Math.ceil(CONFIG.COOLDOWN_HOURS - hoursDiff);
        throw new BadRequestError(`修改昵称需间隔${CONFIG.COOLDOWN_HOURS}小时，请在 ${remaining} 小时后再试`);
      }
    }

    // 3. 检查是否有审核中的任务
    if (user.nameStatus === 'pending') {
      throw new BadRequestError('您有昵称正在审核中，请耐心等待');
    }

    // 4. 重名检查
    const existingUser = await User.findOne({
      name: trimmedName,
      _id: { $ne: userId }
    });
    if (existingUser) {
      throw new BadRequestError('该昵称已被其他用户使用');
    }

    // 5. 本地词库审核（关键步骤：敏感词直接打回）
    const localResult = nameReviewQueue.localWordCheck(trimmedName);
    
    if (!localResult.passed) {
      // 敏感词直接打回，不进入AI队列
      console.log(`[改名申请] 本地审核拒绝: userId=${userId}, reason=${localResult.reason}`);
      throw new BadRequestError(localResult.reason);
    }

    // 6. 本地审核通过，写入待审核状态
    user.pendingName = trimmedName;
    user.nameStatus = 'pending';
    user.nameRejectReason = null;
    await user.save();

    // 7. 加入AI审核队列
    nameReviewQueue.enqueue({
      userId,
      newName: trimmedName,
      needsFocus: localResult.level === 2 // 是否需要AI重点审核
    });

    console.log(`[改名申请] 已加入AI审核队列: userId=${userId}, newName=${trimmedName}`);

    return {
      success: true,
      status: 'pending',
      pendingName: trimmedName,
      message: '申请已提交，正在后台审核中'
    };
  }

  /**
   * 更新头像颜色（直接生效，无需审核）
   * @param {string} userId - 用户ID
   * @param {string} avatarColor - 头像颜色
   * @returns {Object} 更新结果
   */
  static async updateAvatarColor(userId, avatarColor) {
    const allowedColors = ['pink', 'green', 'blue'];
    if (!allowedColors.includes(avatarColor)) {
      throw new BadRequestError('无效的头像颜色选项');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { avatarColor } },
      { new: true }
    ).select('avatarColor');

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    return {
      success: true,
      avatarColor: user.avatarColor
    };
  }

  /**
   * 获取队列状态（管理员接口）
   * @returns {Object} 队列状态
   */
  static getQueueStatus() {
    return nameReviewQueue.getStatus();
  }

  /**
   * 手动触发队列处理（管理员接口）
   * @returns {Object} 触发结果
   */
  static triggerQueueProcess() {
    nameReviewQueue.processQueue();
    return { message: '已触发队列处理' };
  }
}

export default UserServiceProfile;
