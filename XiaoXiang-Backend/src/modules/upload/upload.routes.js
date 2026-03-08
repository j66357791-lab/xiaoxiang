// src/modules/upload/upload.routes.js
import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { uploadSingle, uploadMultiple } from '../../common/middlewares/upload.js';
import { success } from '../../common/utils/response.js';

const router = Router();

/**
 * 单图上传
 * POST /api/upload/single
 * 表单字段名: file
 */
router.post('/single', 
  authenticate,
  authorize('admin', 'superAdmin'),
  uploadSingle('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    // 返回图片访问 URL
    const fileUrl = `/uploads/${req.file.filename}`;
    
    console.log(`[Upload] ✅ 单图上传成功: ${fileUrl}`);
    
    return success(res, {
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, '上传成功');
  }
);

/**
 * 多图上传（最多9张）
 * POST /api/upload/multiple
 * 表单字段名: files
 */
router.post('/multiple',
  authenticate,
  authorize('admin', 'superAdmin'),
  uploadMultiple('files', 9),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    // 返回图片访问 URL 列表
    const fileUrls = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));
    
    console.log(`[Upload] ✅ 多图上传成功: ${fileUrls.length} 张`);
    
    return success(res, fileUrls, `成功上传 ${fileUrls.length} 张图片`);
  }
);

/**
 * 用户上传图片（用于订单凭证等）
 * POST /api/upload/evidence
 * 表单字段名: file
 */
router.post('/evidence',
  authenticate,
  uploadSingle('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    console.log(`[Upload] ✅ 用户凭证上传成功: ${fileUrl}`);
    
    return success(res, {
      url: fileUrl,
      filename: req.file.filename
    }, '上传成功');
  }
);

export default router;
