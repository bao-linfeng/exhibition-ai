#!/usr/bin/env node
/**
 * 触发测试事件的脚本
 *
 * 用法：
 * 1. 设置环境变量 PROJECT_ID 和 AUTH_TOKEN
 * 2. 运行: node scripts/trigger-test-event.mjs
 */

async function triggerTestEvent() {
  const PROJECT_ID = process.env.PROJECT_ID || '';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  if (!PROJECT_ID || !AUTH_TOKEN) {
    console.error('请设置 PROJECT_ID 和 AUTH_TOKEN 环境变量');
    process.exit(1);
  }

  console.log(`触发项目更新事件: ${PROJECT_ID}`);

  try {
    // 获取项目信息
    const getResponse = await fetch(`${API_URL}/api/v1/projects/${PROJECT_ID}`, {
      headers: {
        'Cookie': `session=${AUTH_TOKEN}`,
      },
    });

    if (!getResponse.ok) {
      throw new Error(`获取项目失败: ${getResponse.status} ${getResponse.statusText}`);
    }

    const project = await getResponse.json();
    console.log('当前项目:', project.name, '(revision:', project.revision, ')');

    // 更新项目（触发事件）
    const updateResponse = await fetch(`${API_URL}/api/v1/projects/${PROJECT_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        notes: `测试更新 ${new Date().toISOString()}`,
        expectedRevision: project.revision,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`更新项目失败: ${updateResponse.status} ${error}`);
    }

    const updated = await updateResponse.json();
    console.log('✓ 项目已更新');
    console.log('新 revision:', updated.revision);
    console.log('备注:', updated.notes);
    console.log('\n应该会触发 project.updated 事件！');
  } catch (error) {
    console.error('✗ 错误:', error.message);
    process.exit(1);
  }
}

triggerTestEvent();
