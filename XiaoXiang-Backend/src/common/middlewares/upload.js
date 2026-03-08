// src/common/middlewares/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ✅ 修改：使用 /app/uploads 目录（匹配 Zeabur 挂载路径）
const uploadDir = '/app/uploads';

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[Upload] 📁 创建上传目录: ${uploadDir}`);
}

console.log(`[Upload] 📂 上传目录: ${uploadDir}`);

// 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名：时间戳-随机数.扩展名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('只允许上传图片或 PDF 文件'));
};

// Multer 配置
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 导出不同场景的上传配置
export const uploadSingle = (fieldName) => upload.single(fieldName);
export const uploadMultiple = (fieldName, maxCount = 9) => upload.array(fieldName, maxCount);
export const uploadFields = (fields) => upload.fields(fields);
