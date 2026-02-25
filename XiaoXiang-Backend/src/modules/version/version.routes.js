import { Router } from 'express';

const router = Router();

// GET /api/version - 获取最新版本信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      latestVersion: '1.1.1',
      downloadUrl: 'https://expo.dev/artifacts/eas/0c2250ac-f6e1-4b35-ad3f-b9fcbec73697',
      updateMessage: `【v1.1.1 更新内容】

1. 优化休闲中心功能，拓展体验卡牌回合游戏仙侠客栈
2. 新增积分、小象币玩法
3. 修复已知问题`,
      forceUpdate: false,
      platform: {
        android: 'https://expo.dev/artifacts/eas/0c2250ac-f6e1-4b35-ad3f-b9fcbec73697',
        ios: 'https://expo.dev/artifacts/eas/xxxxx'
      }
    }
  });
});

export default router;
