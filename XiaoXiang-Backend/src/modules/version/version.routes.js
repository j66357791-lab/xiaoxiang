import { Router } from 'express';

const router = Router();

// GET /api/version - 获取最新版本信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      latestVersion: '1.1.2',
      downloadUrl: 'https://expo.dev/artifacts/eas/6fb51ec2-df80-4a4f-94e0-63c11aa1902b',
      updateMessage: `【v1.1.2 更新内容】

1. UI优化
2. 性能提升
3. 漏洞补丁`,
      forceUpdate: false,
      platform: {
        android: 'https://expo.dev/artifacts/eas/6fb51ec2-df80-4a4f-94e0-63c11aa1902b',
        ios: 'https://expo.dev/artifacts/eas/xxxxx'
      }
    }
  });
});

export default router;
