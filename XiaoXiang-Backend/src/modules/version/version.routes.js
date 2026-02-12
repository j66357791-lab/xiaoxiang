import { Router } from 'express';

const router = Router();

// GET /api/version - 获取最新版本信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      latestVersion: '1.0.1',           // 最新版本号（每次发新版改这里）
      downloadUrl: 'https://expo.dev/artifacts/eas/xxxxx', // APK下载链接
      updateMessage: '1. 新增图片选择功能\n2. 修复已知问题\n3. 优化性能',
      forceUpdate: false,               // 是否强制更新
      platform: {
        android: 'https://expo.dev/artifacts/eas/xxxxx', // Android 下载链接
        ios: 'https://expo.dev/artifacts/eas/xxxxx'      // iOS 下载链接
      }
    }
  });
});

export default router;
