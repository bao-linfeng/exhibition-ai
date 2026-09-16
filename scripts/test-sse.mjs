#!/usr/bin/env node
/**
 * SSE 客户端测试脚本
 *
 * 用法：
 * 1. 设置环境变量 PROJECT_ID 和 AUTH_TOKEN
 * 2. 运行: node scripts/test-sse.mjs
 */

import { EventSource } from 'eventsource';

const PROJECT_ID = process.env.PROJECT_ID || '';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const API_URL = process.env.API_URL || 'http://localhost:3000';

if (!PROJECT_ID || !AUTH_TOKEN) {
  console.error('请设置 PROJECT_ID 和 AUTH_TOKEN 环境变量');
  process.exit(1);
}

const url = `${API_URL}/api/v1/projects/${PROJECT_ID}/events`;
console.log(`连接到 SSE 端点: ${url}`);

const eventSource = new EventSource(url, {
  headers: {
    'Cookie': `session=${AUTH_TOKEN}`,
  },
});

eventSource.onopen = () => {
  console.log('✓ SSE 连接已建立');
};

eventSource.onerror = (error) => {
  console.error('✗ SSE 连接错误:', error);
  eventSource.close();
  process.exit(1);
};

// 监听所有类型的事件
const eventTypes = [
  'project.created',
  'project.updated',
  'project.archived',
  'project.restored',
  'brief.confirmed',
  'task.updated',
  'version.created',
  'asset.ready',
];

eventTypes.forEach(type => {
  eventSource.addEventListener(type, (event) => {
    console.log(`\n[${new Date().toISOString()}] 收到事件: ${type}`);
    console.log('事件 ID:', event.lastEventId);
    console.log('数据:', JSON.parse(event.data));
  });
});

// 监听自定义事件
eventSource.addEventListener('stream.reset', (event) => {
  console.log('\n[警告] 流已重置:', JSON.parse(event.data));
});

eventSource.addEventListener('connection.closed', (event) => {
  console.log('\n[警告] 连接被关闭:', JSON.parse(event.data));
  eventSource.close();
  process.exit(0);
});

// 监听通用消息
eventSource.onmessage = (event) => {
  console.log('\n[消息]', event.data);
};

console.log('正在监听事件...');
console.log('按 Ctrl+C 退出\n');

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭连接...');
  eventSource.close();
  process.exit(0);
});
