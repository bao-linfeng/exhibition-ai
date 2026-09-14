#!/bin/bash
set -e

echo "=== 测试登录流程 ==="
echo ""

echo "1. 测试登录 API"
LOGIN_RESPONSE=$(curl -s -c /tmp/test-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@exhibition.local","password":"admin123"}' \
  http://localhost:3000/api/v1/auth/login)

echo "登录响应: $LOGIN_RESPONSE"
echo ""

echo "2. 测试获取当前用户"
ME_RESPONSE=$(curl -s -b /tmp/test-cookies.txt \
  http://localhost:3000/api/v1/auth/me)

echo "当前用户: $ME_RESPONSE"
echo ""

echo "3. 测试登出"
LOGOUT_RESPONSE=$(curl -s -b /tmp/test-cookies.txt -X POST \
  -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:3000/api/v1/auth/logout)

echo "$LOGOUT_RESPONSE"
echo ""

echo "4. 测试登出后访问 /me (应该返回 401)"
ME_AFTER_LOGOUT=$(curl -s -b /tmp/test-cookies.txt -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:3000/api/v1/auth/me)

echo "$ME_AFTER_LOGOUT"
echo ""

rm -f /tmp/test-cookies.txt
echo "=== 测试完成 ==="
