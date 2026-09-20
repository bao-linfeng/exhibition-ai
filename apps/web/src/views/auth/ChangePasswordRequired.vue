<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Eye, EyeOff, LogOut } from 'lucide-vue-next';
import { useAuth } from '../../composables/useAuth.js';
import { apiClient } from '../../api/client.js';
import { useUserStore } from '../../stores/user.js';

const router = useRouter();
const { logout } = useAuth();
const userStore = useUserStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const isSubmitting = ref(false);
const errorMessage = ref('');

// Password strength validation
const passwordRules = [
  { label: '至少8个字符', test: (p: string) => p.length >= 8 },
  { label: '包含大写字母', test: (p: string) => /[A-Z]/.test(p) },
  { label: '包含小写字母', test: (p: string) => /[a-z]/.test(p) },
  { label: '包含数字', test: (p: string) => /[0-9]/.test(p) },
];

const passwordStrength = computed(() => {
  if (!newPassword.value) return 0;
  return passwordRules.filter((rule) => rule.test(newPassword.value)).length;
});

const isPasswordValid = computed(
  () => passwordStrength.value === passwordRules.length,
);

async function handleSubmit() {
  errorMessage.value = '';

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    errorMessage.value = '请填写所有密码字段';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的新密码不一致';
    return;
  }

  if (!isPasswordValid.value) {
    errorMessage.value = '新密码不符合强度要求';
    return;
  }

  try {
    isSubmitting.value = true;
    const { error } = await apiClient.PUT('/api/v1/auth/password', {
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      },
    });

    if (error) {
      errorMessage.value =
        error.message || '密码修改失败，请检查当前密码是否正确';
      return;
    }

    // Refresh user info to clear mustChangePassword flag
    const { data: meData } = await apiClient.GET('/api/v1/auth/me');
    if (meData?.data) {
      userStore.setUser(meData.data);
    }

    // Redirect to home or intended page
    router.push('/dashboard');
  } catch (err: unknown) {
    if (err instanceof Error) {
      errorMessage.value = err.message || '网络错误，请稍后重试';
    } else {
      errorMessage.value = '网络错误，请稍后重试';
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="auth-layout">
    <!-- Left branding panel -->
    <div class="auth-brand">
      <div class="brand-decoration" />
      <div class="brand-content">
        <h2 class="brand-title">展台 AI 创作平台</h2>
        <p class="brand-desc">
          让创意更自由，让搭建更轻松。<br />为您提供专业的 AI 策展体验。
        </p>
      </div>
    </div>

    <!-- Right interaction panel -->
    <div class="auth-panel">
      <div class="auth-card">
        <div class="mobile-header">
          <h2>展台 AI 创作平台</h2>
        </div>

        <div class="auth-header">
          <h1 class="auth-title">需要修改密码</h1>
          <p class="auth-subtitle">为了您的账号安全，首次登录需修改密码</p>
        </div>

        <form class="auth-form" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="currentPassword" class="form-label">当前密码</label>
            <div class="input-wrapper">
              <input
                id="currentPassword"
                v-model="currentPassword"
                :type="showCurrentPassword ? 'text' : 'password'"
                class="form-input"
                placeholder="输入当前密码"
                required
                autocomplete="current-password"
                :disabled="isSubmitting"
              />
              <button
                type="button"
                class="icon-button"
                title="显示/隐藏密码"
                @click="showCurrentPassword = !showCurrentPassword"
              >
                <Eye v-if="!showCurrentPassword" class="icon" />
                <EyeOff v-else class="icon" />
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="newPassword" class="form-label">新密码</label>
            <div class="input-wrapper">
              <input
                id="newPassword"
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                class="form-input"
                placeholder="设置新密码"
                required
                autocomplete="new-password"
                :disabled="isSubmitting"
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

            <!-- Password strength indicator -->
            <div v-if="newPassword" class="password-rules">
              <div
                v-for="rule in passwordRules"
                :key="rule.label"
                class="rule-item"
                :class="{ met: rule.test(newPassword) }"
              >
                <span class="rule-icon">{{
                  rule.test(newPassword) ? '✓' : '○'
                }}</span>
                {{ rule.label }}
              </div>
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
                placeholder="再次输入新密码"
                required
                autocomplete="new-password"
                :disabled="isSubmitting"
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

          <button type="submit" class="submit-button" :disabled="isSubmitting">
            {{ isSubmitting ? '正在提交...' : '修改密码' }}
          </button>

          <button
            type="button"
            class="logout-button"
            :disabled="isSubmitting"
            @click="logout"
          >
            <LogOut class="logout-icon" />
            退出登录
          </button>
        </form>
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
  color: #ef4444; /* Use red for emphasis */
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

.password-rules {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #64748b;
  transition: color 0.2s;
}

.rule-item.met {
  color: #10b981;
}

.rule-icon {
  font-size: 0.75rem;
  font-weight: bold;
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

.logout-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background-color: #ffffff;
  color: #64748b;
  font-size: 0.9375rem;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-button:hover:not(:disabled) {
  background-color: #f8fafc;
  color: #334155;
  border-color: #cbd5e1;
}

.logout-button:active:not(:disabled) {
  background-color: #f1f5f9;
}

.logout-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.logout-icon {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
