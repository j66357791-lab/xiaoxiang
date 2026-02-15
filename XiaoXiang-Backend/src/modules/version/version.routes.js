import { Router } from 'express';

const router = Router();

// GET /api/version - 获取最新版本信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      latestVersion: '1.0.2',
      downloadUrl: 'https://expo.dev/artifacts/eas/5973b156-f725-45cf-a52b-7a2078160cd7',
      updateMessage: `【v1.0.2.1 更新内容】

1. 推送简单内测休闲中心体验安装`,
      forceUpdate: false,
      platform: {
        android: 'https://expo.dev/artifacts/eas/5973b156-f725-45cf-a52b-7a2078160cd7',
        ios: 'https://expo.dev/artifacts/eas/xxxxx'
      }
    }
  });
});

export default router;
