import Announcement from './announcement.model.js';
import { clearCache } from '../../common/middlewares/cache.js';

// 获取活跃公告（用户端）
export const getActiveAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('[Announcement] 获取公告失败:', error);
    res.status(500).json({
      success: false,
      message: '获取公告失败'
    });
  }
};

// 获取所有公告（管理员）
export const getAllAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Announcement.countDocuments();
    
    res.json({
      success: true,
      data: announcements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
  } catch (error) {
    console.error('[Announcement] 获取公告列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取公告列表失败'
    });
  }
};

// 获取单个公告
export const getAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }
    
    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    console.error('[Announcement] 获取公告失败:', error);
    res.status(500).json({
      success: false,
      message: '获取公告失败'
    });
  }
};

// 创建公告
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, type, imageUrl, isActive, isBold, isCenter } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: '公告标题不能为空'
      });
    }
    
    if (type === 'text' && (!content || !content.trim())) {
      return res.status(400).json({
        success: false,
        message: '文字公告内容不能为空'
      });
    }
    
    if (type === 'image' && !imageUrl) {
      return res.status(400).json({
        success: false,
        message: '图片公告需要上传图片'
      });
    }
    
    const announcement = new Announcement({
      title: title.trim(),
      content: content?.trim() || '',
      type: type || 'text',
      imageUrl: imageUrl || '',
      isActive: isActive !== false,
      isBold: isBold || false,
      isCenter: isCenter || false,
      createdBy: req.user?._id
    });
    
    await announcement.save();
    
    // 清除缓存
    try {
      clearCache('/api/announcements');
    } catch (e) {
      console.log('[Announcement] 清除缓存跳过');
    }
    
    console.log(`[Announcement] 创建公告成功: ${announcement.title}`);
    
    res.json({
      success: true,
      data: announcement,
      message: '公告发布成功'
    });
  } catch (error) {
    console.error('[Announcement] 创建公告失败:', error);
    res.status(500).json({
      success: false,
      message: '创建公告失败'
    });
  }
};

// 更新公告
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, imageUrl, isActive, isBold, isCenter } = req.body;
    
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }
    
    // 更新字段
    if (title !== undefined) announcement.title = title.trim();
    if (content !== undefined) announcement.content = content.trim();
    if (type !== undefined) announcement.type = type;
    if (imageUrl !== undefined) announcement.imageUrl = imageUrl;
    if (isActive !== undefined) announcement.isActive = isActive;
    if (isBold !== undefined) announcement.isBold = isBold;
    if (isCenter !== undefined) announcement.isCenter = isCenter;
    
    await announcement.save();
    
    // 清除缓存
    try {
      clearCache('/api/announcements');
    } catch (e) {
      console.log('[Announcement] 清除缓存跳过');
    }
    
    console.log(`[Announcement] 更新公告成功: ${announcement.title}`);
    
    res.json({
      success: true,
      data: announcement,
      message: '公告更新成功'
    });
  } catch (error) {
    console.error('[Announcement] 更新公告失败:', error);
    res.status(500).json({
      success: false,
      message: '更新公告失败'
    });
  }
};

// 删除公告
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }
    
    // 清除缓存
    try {
      clearCache('/api/announcements');
    } catch (e) {
      console.log('[Announcement] 清除缓存跳过');
    }
    
    console.log(`[Announcement] 删除公告成功: ${announcement.title}`);
    
    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    console.error('[Announcement] 删除公告失败:', error);
    res.status(500).json({
      success: false,
      message: '删除公告失败'
    });
  }
};
