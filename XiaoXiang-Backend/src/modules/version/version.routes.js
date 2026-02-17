import { Router } from 'express';

const router = Router();

// GET /api/version - 获取最新版本信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      latestVersion: '1.0.2',
      downloadUrl: 'https://expo.dev/artifacts/eas/acbb3fc5-1bcc-4410-afc8-ce839fa990fa',
      updateMessage: `【v1.0.2 更新内容】

1. 优化团长体系：新注册团长默认为一级团长，邀请成员即可享受相应权益；重构UI设计，新增详细数据展示，优化查询功能

2. 修复钱包提现明细显示异常问题，优化钱包页面操作流程，提升账单核验便捷性

3. 修复应用图标及名称显示问题

4. 优化底部导航栏布局，将订单列表调整为休闲中心，为后续生态拓展奠定基础；同步优化个人中心UI设计及功能模块

5. 优化消息推送功能，任务接单成功后将收到实时通知提醒`,
      forceUpdate: false,
      platform: {
        android: 'https://expo.dev/artifacts/eas/acbb3fc5-1bcc-4410-afc8-ce839fa990fa',
        ios: 'https://expo.dev/artifacts/eas/xxxxx'
      }
    }
  });
});

export default router;
