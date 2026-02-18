// src/modules/GameCenter/guitusaipao/RaceGame.socket.js
import { WebSocketServer } from 'ws';
import { RaceGameManager, setBroadcastFunction, setSendToUserFunction } from './RaceGame.service.js';

let wss = null;
const clients = new Map();

/**
 * 初始化 WebSocket 服务器
 */
export const initRaceSocket = (server) => {
  wss = new WebSocketServer({ 
    server,
    path: '/ws/race'
  });
  
  // 设置广播函数
  setBroadcastFunction(broadcast);
  setSendToUserFunction(sendToUser);
  
  wss.on('connection', (ws, req) => {
    const clientId = Date.now() + Math.random();
    clients.set(clientId, { ws, userId: null });
    
    console.log(`[RaceSocket] 客户端连接: ${clientId}, 当前连接数: ${clients.size}`);
    
    // 发送当前状态
    const state = RaceGameManager.getCurrentState();
    ws.send(JSON.stringify({ type: 'race:state', data: state }));
    
    ws.on('message', (message) => {
      try {
        const { type, data } = JSON.parse(message);
        handleMessage(clientId, ws, type, data);
      } catch (error) {
        console.error('[RaceSocket] 消息解析错误:', error);
      }
    });
    
    ws.on('close', () => {
      const client = clients.get(clientId);
      if (client?.userId) {
        console.log(`[RaceSocket] 用户 ${client.userId} 断开连接`);
      }
      clients.delete(clientId);
      console.log(`[RaceSocket] 当前连接数: ${clients.size}`);
    });
    
    ws.on('error', (error) => {
      console.error('[RaceSocket] 连接错误:', error);
    });
  });
  
  console.log('[RaceSocket] ✅ WebSocket 服务器已启动 /ws/race');
};

/**
 * 处理消息
 */
const handleMessage = async (clientId, ws, type, data) => {
  switch (type) {
    case 'auth':
      // 用户认证
      const client = clients.get(clientId);
      if (client && data?.userId) {
        client.userId = data.userId;
        console.log(`[RaceSocket] 用户 ${data.userId} 认证成功`);
      }
      break;
      
    case 'race:get_state':
      const state = RaceGameManager.getCurrentState();
      ws.send(JSON.stringify({ type: 'race:state', data: state }));
      break;
      
    case 'race:bet':
      try {
        const client = clients.get(clientId);
        if (!client?.userId) {
          ws.send(JSON.stringify({ 
            type: 'race:bet_error', 
            data: { message: '请先登录' } 
          }));
          return;
        }
        
        const result = await RaceGameManager.placeBet(
          client.userId, 
          data.side, 
          data.amount
        );
        ws.send(JSON.stringify({ type: 'race:bet_success', data: result }));
      } catch (error) {
        ws.send(JSON.stringify({ 
          type: 'race:bet_error', 
          data: { message: error.message } 
        }));
      }
      break;
  }
};

/**
 * 广播消息给所有客户端
 */
const broadcast = (event, data) => {
  const message = JSON.stringify({ type: event, data });
  let sent = 0;
  
  clients.forEach((client) => {
    if (client.ws && client.ws.readyState === 1) {
      try {
        client.ws.send(message);
        sent++;
      } catch (e) {
        console.error('[RaceSocket] 发送失败:', e);
      }
    }
  });
  
  console.log(`[RaceSocket] 广播 ${event} -> ${sent} 客户端`);
};

/**
 * 发送消息给特定用户
 */
const sendToUser = (userId, event, data) => {
  const message = JSON.stringify({ type: event, data });
  
  clients.forEach((client) => {
    if (client.userId === userId && client.ws?.readyState === 1) {
      client.ws.send(message);
    }
  });
};

/**
 * 获取当前连接数
 */
export const getConnectedCount = () => clients.size;
