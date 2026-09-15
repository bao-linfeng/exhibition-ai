<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';
import {
  useSendCodeMutation,
  useForgotPasswordMutation,
} from '../../api/queries/auth.js';

const sendCodeMutation = useSendCodeMutation();
const forgotPasswordMutation = useForgotPasswordMutation();

const step = ref(1);
const email = ref('');
const code = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const countdown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const errorMessage = ref('');
const isSuccess = ref(false);

function startCountdown() {
  countdown.value = 60;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      if (timer) clearInterval(timer);
    }
  }, 1000);
}

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

async function handleSendCode() {
  errorMessage.value = '';
  if (!email.value) {
    errorMessage.value = '请输入邮箱';
    return;
  }

  try {
    await sendCodeMutation.mutateAsync({
      email: email.value,
      type: 'reset_password',
    });
    step.value = 2;
    startCountdown();
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string } | null;
    if (e?.status === 429) {
      errorMessage.value = '发送太频繁，请稍后再试';
    } else if (e?.status === 404) {
      errorMessage.value = '该邮箱未注册';
    } else {
      errorMessage.value = e?.message ?? '发送验证码失败';
    }
  }
}

async function handleResetPassword() {
  errorMessage.value = '';
  if (!code.value || !newPassword.value || !confirmPassword.value) {
    errorMessage.value = '请填写完整信息';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致';
    return;
  }

  try {
    await forgotPasswordMutation.mutateAsync({
      email: email.value,
      code: code.value,
      newPassword: newPassword.value,
    });
    isSuccess.value = true;
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string } | null;
    if (e?.status === 400) {
      errorMessage.value = '验证码错误或已过期';
    } else {
      errorMessage.value = e?.message ?? '重置密码失败';
    }
  }
}

async function resendCode() {
  if (countdown.value > 0) return;
  errorMessage.value = '';
  try {
    await sendCodeMutation.mutateAsync({
      email: email.value,
      type: 'reset_password',
    });
    startCountdown();
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string } | null;
    if (e?.status === 429) {
      errorMessage.value = '发送太频繁，请稍后再试';
    } else {
      errorMessage.value = e?.message ?? '发送验证码失败';
    }
  }
}
</script>

<template>
  <div class="auth-layout">
    <!-- 左侧品牌区 -->
    <div class="auth-brand">
      <div class="brand-decoration" />
      <div class="brand-content">
        <h2 class="brand-title">展台 AI 设计平台</h2>
        <p class="brand-desc">
          智能驱动，极速生成。<br />为展览行业打造的专业级 AI 设计引擎。
        </p>
      </div>
    </div>

    <!-- 右侧交互区 -->
    <div class="auth-panel">
      <div class="auth-card">
        <div class="mobile-header">
          <h2>展台 AI 设计平台</h2>
        </div>

        <div v-if="isSuccess" class="success-container">
          <div class="success-icon">✓</div>
          <h2 class="success-title">密码已重置</h2>
          <p class="success-text">您的密码已成功重置，请使用新密码重新登录。</p>
          <RouterLink
            to="/login"
            class="submit-button"
            style="
              display: block;
              width: 100%;
              text-align: center;
              text-decoration: none;
              box-sizing: border-box;
            "
          >
            返回登录
          </RouterLink>
        </div>

        <template v-else>
          <div class="auth-header">
            <h1 class="auth-title">找回密码</h1>
            <p class="auth-subtitle">验证邮箱以重置您的密码</p>
          </div>

          <!-- Step 1 -->
          <form
            v-if="step === 1"
            class="auth-form"
            @submit.prevent="handleSendCode"
          >
            <div class="form-group">
              <label for="email" class="form-label">注册邮箱</label>
              <input
                id="email"
                v-model="email"
                type="email"
                class="form-input"
                placeholder="name@company.com"
                required
                autocomplete="email"
                :disabled="sendCodeMutation.isPending.value"
              />
            </div>

            <div v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>

            <button
              type="submit"
              class="submit-button"
              :disabled="sendCodeMutation.isPending.value"
            >
              {{
                sendCodeMutation.isPending.value ? '发送中...' : '发送验证码'
              }}
            </button>
          </form>

          <!-- Step 2 -->
          <form v-else class="auth-form" @submit.prevent="handleResetPassword">
            <div class="form-group">
              <label class="form-label">已发送验证码至</label>
              <div class="email-display">
                <span>{{ email }}</span>
                <button
                  type="button"
                  class="resend-button"
                  :disabled="countdown > 0 || sendCodeMutation.isPending.value"
                  @click="resendCode"
                >
                  {{ countdown > 0 ? `${countdown}s 后重发` : '重新发送' }}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="code" class="form-label">验证码</label>
              <input
                id="code"
                v-model="code"
                type="text"
                class="form-input"
                placeholder="6位数字"
                required
                maxlength="6"
                :disabled="forgotPasswordMutation.isPending.value"
              />
            </div>

            <div class="form-group">
              <label for="newPassword" class="form-label">新密码</label>
              <div class="input-wrapper">
                <input
                  id="newPassword"
                  v-model="newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  class="form-input"
                  placeholder="••••••••"
                  required
                  autocomplete="new-password"
                  :disabled="forgotPasswordMutation.isPending.value"
                />
                <button
                  type="button"
                  class="icon-button"
                  title="显示/隐藏密码"
                  @click="showNewPassword = !showNewPassword"
                >
                  <Eye v-if="!showNewPassword" class="icon" />
                  <EyeOff v-else class="icon" />
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="confirmPassword" class="form-label">确认新密码</label>
              <div class="input-wrapper">
                <input
                  id="confirmPassword"
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="form-input"
                  placeholder="••••••••"
                  required
                  autocomplete="new-password"
                  :disabled="forgotPasswordMutation.isPending.value"
                />
                <button
                  type="button"
                  class="icon-button"
                  title="显示/隐藏密码"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <Eye v-if="!showConfirmPassword" class="icon" />
                  <EyeOff v-else class="icon" />
                </button>
              </div>
            </div>

            <div v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>

            <button
              type="submit"
              class="submit-button"
              :disabled="forgotPasswordMutation.isPending.value"
            >
              {{
                forgotPasswordMutation.isPending.value
                  ? '提交中...'
                  : '重置密码'
              }}
            </button>
          </form>
        </template>

        <div v-if="!isSuccess" class="auth-footer">
          <p class="footer-text">
            记起密码了？<RouterLink to="/login" class="text-link">
              返回登录
            </RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  display: flex;
  min-height: 100vh;
  background-color: #ffffff;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
}

.auth-brand {
  display: none;
  position: relative;
  width: 45%;
  max-width: 600px;
  background: #0f172a;
  color: #ffffff;
  overflow: hidden;
}

@media (min-width: 900px) {
  .auth-brand {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
}

.brand-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(
      circle at 15% 50%,
      rgba(37, 99, 235, 0.15) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 85% 30%,
      rgba(249, 115, 22, 0.08) 0%,
      transparent 50%
    );
  z-index: 1;
}

.brand-decoration::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0) 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0) 100%
  );
}

.brand-content {
  position: relative;
  z-index: 2;
  padding: 4rem;
  margin-top: auto;
  margin-bottom: auto;
}

.brand-title {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-desc {
  font-size: 1.125rem;
  line-height: 1.7;
  color: #94a3b8;
  max-width: 400px;
}

.auth-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: #f8fafc;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  padding: 3rem;
  border-radius: 1.5rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.02),
    0 10px 15px -3px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(226, 232, 240, 0.8);
}

.mobile-header {
  display: none;
  text-align: center;
  margin-bottom: 2rem;
}

.mobile-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

@media (max-width: 899px) {
  .mobile-header {
    display: block;
  }
}

.auth-header {
  margin-bottom: 2.5rem;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.5rem;
  letter-spacing: -0.025em;
}

.auth-subtitle {
  font-size: 0.9375rem;
  color: #64748b;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  font-size: 0.9375rem;
  color: #0f172a;
  transition: all 0.2s ease;
  box-sizing: border-box;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
}

.form-input::placeholder {
  color: #94a3b8;
}

.form-input:hover:not(:disabled) {
  border-color: #94a3b8;
}

.form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.form-input:disabled {
  background-color: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper .form-input {
  padding-right: 2.75rem;
}

.icon-button {
  position: absolute;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  border-radius: 0.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-button:hover {
  color: #475569;
  background-color: #f1f5f9;
}

.icon {
  width: 1.25rem;
  height: 1.25rem;
}

.email-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  font-size: 0.9375rem;
  color: #334155;
}

.resend-button {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.resend-button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.resend-button:hover:not(:disabled) {
  background-color: #eff6ff;
  color: #1d4ed8;
}

.error-message {
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  background-color: #fef2f2;
  border-left: 4px solid #ef4444;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.875rem;
  font-weight: 500;
}

.submit-button {
  margin-top: 0.5rem;
  padding: 0.875rem 1.5rem;
  background-color: #2563eb;
  color: #ffffff;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
}

.submit-button:hover:not(:disabled) {
  background-color: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 6px 8px -1px rgba(37, 99, 235, 0.25);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  background-color: #94a3b8;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.7;
}

.auth-footer {
  margin-top: 2.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.footer-text {
  font-size: 0.875rem;
  color: #64748b;
}

.text-link {
  color: #2563eb;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
  margin-left: 0.25rem;
}

.text-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.success-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 0;
}

.success-icon {
  width: 4rem;
  height: 4rem;
  background-color: #dcfce7;
  color: #16a34a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  box-shadow: 0 0 0 8px rgba(22, 163, 74, 0.1);
}

.success-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.75rem;
}

.success-text {
  font-size: 0.9375rem;
  color: #64748b;
  margin-bottom: 2rem;
  line-height: 1.6;
}
</style>
