#!/usr/bin/env node

/**
 * SSE 端到端测试脚本
 *
 * 验证：
 * 1. SSE 连接建立
 * 2. 心跳接收
 * 3. 事件推送
 * 4. 断线重连
 * 5. 权限验证
 */

import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 60000; // 60 秒

// 测试用户凭证（需要先创建测试用户）
const TEST_USER = {
  email: 'admin@example.com',
  password: 'Admin123!@#',
};

let authCookie = '';
let testProjectId = '';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ ${message}`, colors.blue);
}

function debug(message) {
  log(`  ${message}`, colors.gray);
}

async function login() {
  info('登录测试用户...');
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });

  if (!response.ok) {
    throw new Error(`登录失败: ${response.status} ${await response.text()}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('未收到 Session Cookie');
  }

  authCookie = setCookie.split(';')[0];
  success('登录成功');
  debug(`Cookie: ${authCookie.substring(0, 30)}...`);
}

async function createTestProject() {
  info('创建测试项目...');

  // 先获取或创建客户
  const customersResponse = await fetch(`${API_URL}/api/v1/customers`, {
    headers: { Cookie: authCookie },
  });

  const customers = await customersResponse.json();
  let customerId = customers.data?.[0]?.id;

  if (!customerId) {
    const createCustomerResponse = await fetch(`${API_URL}/api/v1/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        name: 'SSE 测试客户',
        contact: '测试联系人',
      }),
    });

    const customer = await createCustomerResponse.json();
    customerId = customer.id;
  }

  const response = await fetch(`${API_URL}/api/v1/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookie,
    },
    body: JSON.stringify({
      name: `SSE 测试项目 ${Date.now()}`,
      customerId,
    }),
  });

  if (!response.ok) {
    throw new Error(`创建项目失败: ${response.status}`);
  }

  const project = await response.json();
  testProjectId = project.id;
  success(`项目创建成功: ${testProjectId}`);
}

function testSSEConnection() {
  return new Promise((resolve, reject) => {
    info('测试 SSE 连接...');

    const url = `${API_URL}/api/v1/projects/${testProjectId}/events`;
    debug(`连接 URL: ${url}`);

    const eventSource = new EventSource(url, {
      headers: { Cookie: authCookie },
    });

    const receivedEvents = [];
    let heartbeatCount = 0;
    const timeout = setTimeout(() => {
      eventSource.close();
      reject(new Error('连接超时（15秒无响应）'));
    }, 15000);

    eventSource.addEventListener('open', () => {
      success('SSE 连接已建立');
      clearTimeout(timeout);
    });

    eventSource.addEventListener('message', (event) => {
      debug(`收到消息: ${event.data.substring(0, 100)}...`);
    });

    // 监听心跳
    eventSource.addEventListener('comment', () => {
      heartbeatCount++;
      debug(`收到心跳 #${heartbeatCount}`);
    });

    // 监听项目事件
    eventSource.addEventListener('project.updated', (event) => {
      const data = JSON.parse(event.data);
      receivedEvents.push(data);
      success(`收到项目更新事件: sequence=${event.lastEventId}`);
      debug(`事件数据: ${JSON.stringify(data, null, 2)}`);
    });

    eventSource.addEventListener('project.created', (event) => {
      const data = JSON.parse(event.data);
      receivedEvents.push(data);
      success(`收到项目创建事件: sequence=${event.lastEventId}`);
    });

    eventSource.addEventListener('brief.confirmed', (event) => {
      const data = JSON.parse(event.data);
      receivedEvents.push(data);
      success(`收到 Brief 确认事件: sequence=${event.lastEventId}`);
    });

    eventSource.addEventListener('error', (err) => {
      error(`SSE 错误: ${err.message || '未知错误'}`);
      eventSource.close();
      reject(err);
    });

    // 保持连接 5 秒后关闭
    setTimeout(() => {
      eventSource.close();
      success(`SSE 连接测试完成（收到 ${receivedEvents.length} 个事件，${heartbeatCount} 个心跳）`);
      resolve(receivedEvents);
    }, 5000);
  });
}

async function testEventPush() {
  info('测试事件推送...');

  const url = `${API_URL}/api/v1/projects/${testProjectId}/events`;
  const eventSource = new EventSource(url, {
    headers: { Cookie: authCookie },
  });

  return new Promise((resolve, reject) => {
    let eventReceived = false;

    eventSource.addEventListener('project.updated', (event) => {
      eventReceived = true;
      success('✓ 收到推送的项目更新事件');
      debug(`lastEventId: ${event.lastEventId}`);
      eventSource.close();
      resolve();
    });

    eventSource.addEventListener('error', (err) => {
      eventSource.close();
      reject(err);
    });

    // 等待连接建立后触发事件
    setTimeout(async () => {
      info('触发项目更新事件...');

      // 先获取当前项目信息
      const getResponse = await fetch(`${API_URL}/api/v1/projects/${testProjectId}`, {
        headers: { Cookie: authCookie },
      });
      const project = await getResponse.json();

      // 更新项目
      const updateResponse = await fetch(`${API_URL}/api/v1/projects/${testProjectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie,
        },
        body: JSON.stringify({
          notes: `SSE 测试 - ${new Date().toISOString()}`,
          expectedRevision: project.revision,
        }),
      });

      if (!updateResponse.ok) {
        error(`更新项目失败: ${updateResponse.status}`);
        eventSource.close();
        reject(new Error('更新项目失败'));
      } else {
        debug('项目更新请求已发送');
      }

      // 10 秒后超时
      setTimeout(() => {
        if (!eventReceived) {
          eventSource.close();
          reject(new Error('10 秒内未收到事件'));
        }
      }, 10000);
    }, 1000);
  });
}

async function testReconnection() {
  info('测试断线重连...');

  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/v1/projects/${testProjectId}/events`;
    let eventSource = new EventSource(url, {
      headers: { Cookie: authCookie },
    });

    let firstSequence = null;

    eventSource.addEventListener('open', () => {
      success('首次连接成功');
    });

    eventSource.addEventListener('project.updated', (event) => {
      firstSequence = parseInt(event.lastEventId, 10);
      success(`收到事件 sequence=${firstSequence}，关闭连接...`);

      eventSource.close();

      // 等待 2 秒后重连
      setTimeout(() => {
        info('使用 after 参数重连...');
        const reconnectUrl = `${url}?after=${firstSequence}`;

        eventSource = new EventSource(reconnectUrl, {
          headers: { Cookie: authCookie },
        });

        eventSource.addEventListener('open', () => {
          success('重连成功（断点续传）');
          eventSource.close();
          resolve();
        });

        eventSource.addEventListener('error', () => {
          eventSource.close();
          reject(new Error('重连失败'));
        });

        setTimeout(() => {
          eventSource.close();
          reject(new Error('重连超时'));
        }, 5000);
      }, 2000);
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      reject(new Error('首次连接失败'));
    });

    // 触发事件
    setTimeout(async () => {
      const getResponse = await fetch(`${API_URL}/api/v1/projects/${testProjectId}`, {
        headers: { Cookie: authCookie },
      });
      const project = await getResponse.json();

      await fetch(`${API_URL}/api/v1/projects/${testProjectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie,
        },
        body: JSON.stringify({
          notes: `重连测试 - ${new Date().toISOString()}`,
          expectedRevision: project.revision,
        }),
      });
    }, 1000);

    setTimeout(() => {
      eventSource.close();
      reject(new Error('重连测试超时'));
    }, 15000);
  });
}

async function testUnauthorizedAccess() {
  info('测试未授权访问...');

  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/v1/projects/${testProjectId}/events`;

    // 不带 Cookie 连接
    const eventSource = new EventSource(url);

    eventSource.addEventListener('open', () => {
      error('✗ 未授权连接不应成功');
      eventSource.close();
      reject(new Error('安全测试失败：未授权连接成功'));
    });

    eventSource.addEventListener('error', () => {
      success('未授权访问被正确拒绝');
      eventSource.close();
      resolve();
    });

    setTimeout(() => {
      eventSource.close();
      reject(new Error('未授权测试超时'));
    }, 5000);
  });
}

async function runTests() {
  console.log('\n========================================');
  console.log('SSE 端到端测试');
  console.log('========================================\n');

  try {
    await login();
    await createTestProject();

    console.log('\n--- 测试 1: SSE 连接 ---');
    await testSSEConnection();

    console.log('\n--- 测试 2: 事件推送 ---');
    await testEventPush();

    console.log('\n--- 测试 3: 断线重连 ---');
    await testReconnection();

    console.log('\n--- 测试 4: 未授权访问 ---');
    await testUnauthorizedAccess();

    console.log('\n========================================');
    success('所有测试通过 ✓');
    console.log('========================================\n');

    process.exit(0);
  } catch (err) {
    console.log('\n========================================');
    error(`测试失败: ${err.message}`);
    console.log('========================================\n');
    console.error(err);
    process.exit(1);
  }
}

runTests();
