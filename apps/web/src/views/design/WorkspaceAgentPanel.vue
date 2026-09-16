<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import {
  MessageSquare,
  Sparkles,
  Wrench,
  AlertCircle,
  FileCheck,
  Send,
  Loader2,
  XCircle,
  Info,
} from '@lucide/vue';
import { apiClient } from '@/api/client.js';
import { useProjectEvents } from '@/composables/useProjectEvents.js';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Message } from '@exhibition/contracts';

const props = defineProps<{ projectId: string }>();
const queryClient = useQueryClient();

// UI Refs
const scrollContainer = ref<HTMLElement | null>(null);
const inputMessage = ref('');
const isSending = ref(false);

const conversationKey = computed(() => ['conversation', props.projectId]);
const messagesKey = computed(() => [
  'conversation',
  props.projectId,
  'messages',
]);

// Load Conversation
const { data: conversationData } = useQuery({
  queryKey: conversationKey,
  queryFn: async () => {
    const { data, error } = await apiClient.GET(
      '/api/v1/projects/{projectId}/conversation',
      {
        params: { path: { projectId: props.projectId } },
      },
    );
    if (error) throw new Error('Failed to load conversation');
    return data;
  },
});
const conversation = computed(() => conversationData.value?.data);

// --- Confirmation Dialog State ---
const confirmationDialogOpen = ref(false);
const activeConfirmationId = ref<string | null>(null);
const isApproving = ref(false);
const isRejecting = ref(false);

const confirmationDetailKey = computed(() => [
  'confirmation',
  activeConfirmationId.value || '',
]);

const { data: confirmationDetailData, isLoading: isLoadingConfirmation } =
  useQuery({
    queryKey: confirmationDetailKey,
    queryFn: async () => {
      if (!activeConfirmationId.value) return null;
      const { data, error } = await apiClient.GET(
        '/api/v1/confirmations/{id}',
        {
          params: { path: { id: activeConfirmationId.value } },
        },
      );
      if (error) throw new Error('Failed to load confirmation');
      return data;
    },
    enabled: computed(
      () => !!activeConfirmationId.value && confirmationDialogOpen.value,
    ),
  });

const confirmationDetail = computed(() => confirmationDetailData.value?.data);

function openConfirmationDialog(confirmationId: string) {
  if (!confirmationId) return;
  activeConfirmationId.value = confirmationId;
  confirmationDialogOpen.value = true;
}

async function handleApprove() {
  if (!confirmationDetail.value || isApproving.value) return;
  isApproving.value = true;
  try {
    const { error } = await apiClient.POST(
      '/api/v1/confirmations/{id}/approve',
      {
        params: { path: { id: confirmationDetail.value.id } },
        body: { payloadHash: confirmationDetail.value.payloadHash },
      },
    );
    if (error) {
      alert(
        '批准失败：' + ((error as { message?: string }).message ?? '未知错误'),
      );
      return;
    }
    confirmationDialogOpen.value = false;
    queryClient.invalidateQueries({ queryKey: messagesKey.value });
    queryClient.invalidateQueries({ queryKey: conversationKey.value });
  } finally {
    isApproving.value = false;
  }
}

async function handleReject() {
  if (!confirmationDetail.value || isRejecting.value) return;
  isRejecting.value = true;
  try {
    const { error } = await apiClient.POST(
      '/api/v1/confirmations/{id}/reject',
      {
        params: { path: { id: confirmationDetail.value.id } },
        body: { reason: undefined },
      },
    );
    if (error) {
      alert('拒绝失败');
      return;
    }
    confirmationDialogOpen.value = false;
    queryClient.invalidateQueries({ queryKey: messagesKey.value });
    queryClient.invalidateQueries({ queryKey: conversationKey.value });
  } finally {
    isRejecting.value = false;
  }
}

// Load Messages
const { data: messagesResponse } = useQuery({
  queryKey: messagesKey,
  queryFn: async () => {
    const { data, error } = await apiClient.GET(
      '/api/v1/projects/{projectId}/conversation/messages',
      {
        params: {
          path: { projectId: props.projectId },
          query: { limit: 20 },
        },
      },
    );
    if (error) throw new Error('Failed to load messages');
    return data;
  },
});

const localMessages = ref<Message[]>([]);

watch(
  () => messagesResponse.value?.data,
  (newMsgs) => {
    if (!newMsgs) return;
    const existingMap = new Map(localMessages.value.map((m) => [m.id, m]));

    // Sort by createdAt ascending (oldest first)
    const sorted = [...newMsgs].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    localMessages.value = sorted.map((newMsg) => {
      const existing = existingMap.get(newMsg.id);
      // Keep streaming text if we have it locally, to avoid jitter from stale API fetch
      if (
        existing &&
        existing.status === 'streaming' &&
        newMsg.status !== 'completed'
      ) {
        return existing;
      }
      return newMsg;
    });

    scrollToBottom();
  },
  { immediate: true },
);

// Auto scroll to bottom
const scrollToBottom = async () => {
  await nextTick();
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

// SSE Events
const { status: sseStatus } = useProjectEvents({
  projectId: props.projectId,
  onEvent: (event) => {
    if (event.type === 'message.delta') {
      const { messageId, delta } = event.data as {
        messageId: string;
        delta: string;
      };
      const msg = localMessages.value.find((m) => m.id === messageId);
      if (msg) {
        msg.status = 'streaming';
        const textPart = msg.parts.find((p) => p.type === 'text');
        if (textPart && textPart.type === 'text') {
          textPart.text += delta;
        } else if (!textPart) {
          msg.parts.push({ type: 'text', text: delta });
        }
        scrollToBottom();
      }
    } else if (event.type === 'message.completed') {
      const { messageId } = event.data as { messageId: string };
      const msg = localMessages.value.find((m) => m.id === messageId);
      if (msg) {
        msg.status = 'completed';
      }
      queryClient.invalidateQueries({ queryKey: messagesKey.value });
      queryClient.invalidateQueries({ queryKey: conversationKey.value });
    } else if (event.type === 'confirmation.created') {
      queryClient.invalidateQueries({ queryKey: messagesKey.value });
    }
  },
});

// Send Message
const sendMessageMutation = useMutation({
  mutationFn: async (text: string) => {
    const clientMessageId = crypto.randomUUID();

    // Optimistic UI update
    localMessages.value.push({
      id: clientMessageId, // temporary ID
      conversationId: conversation.value?.id || '',
      role: 'user',
      parts: [{ type: 'text', text }],
      status: 'completed',
      clientMessageId,
      createdBy: null,
      createdAt: new Date().toISOString(),
    });
    scrollToBottom();

    const { data, error } = await apiClient.POST(
      '/api/v1/projects/{projectId}/conversation/messages',
      {
        params: { path: { projectId: props.projectId } },
        body: { text, clientMessageId },
      },
    );

    if (error) {
      if ((error as { code?: string }).code === 'ACTIVE_RUN_EXISTS') {
        throw new Error('助手正在思考中，请稍后');
      }
      throw new Error('发送失败');
    }
    return data;
  },
  onSuccess: () => {
    inputMessage.value = '';
    queryClient.invalidateQueries({ queryKey: messagesKey.value });
    queryClient.invalidateQueries({ queryKey: conversationKey.value });
  },
  onError: (error) => {
    // Note: The UI doesn't remove the optimistic message on error currently, but shows alert
    alert(error.message);
    queryClient.invalidateQueries({ queryKey: messagesKey.value });
  },
});

async function handleSend() {
  if (!inputMessage.value.trim() || isSending.value) return;

  if (conversation.value?.activeRunId) {
    alert('助手正在思考中，请稍后');
    return;
  }

  isSending.value = true;
  try {
    await sendMessageMutation.mutateAsync(inputMessage.value.trim());
  } finally {
    isSending.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = '';
  target.style.height = Math.min(target.scrollHeight, 100) + 'px';
}
</script>

<template>
  <div class="h-full flex flex-col bg-slate-900/30">
    <!-- Header -->
    <div
      class="flex items-center gap-2 p-4 border-b border-slate-800/50 shrink-0"
    >
      <MessageSquare class="w-5 h-5 text-slate-100" />
      <h3 class="font-semibold text-slate-100 flex-1">AI 设计助手</h3>
      <div
        class="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"
        :class="
          sseStatus === 'connected'
            ? 'bg-green-500'
            : 'bg-slate-500 shadow-none'
        "
        :title="sseStatus === 'connected' ? '已连接' : '未连接'"
      ></div>
    </div>

    <!-- Messages Area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-6" ref="scrollContainer">
      <div
        v-if="!localMessages.length && messagesResponse?.data"
        class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500"
      >
        <Sparkles class="w-8 h-8 mb-4 text-slate-600/50" />
        <p class="text-sm">向 AI 助手发送消息开始对话</p>
      </div>

      <div
        v-else-if="!localMessages.length"
        class="h-full flex flex-col items-center justify-center"
      >
        <Loader2 class="w-6 h-6 text-slate-600 animate-spin" />
      </div>

      <template v-for="msg in localMessages" :key="msg.id">
        <!-- User Message -->
        <div v-if="msg.role === 'user'" class="flex justify-end">
          <div
            class="max-w-[85%] bg-blue-600/30 border border-blue-500/20 text-blue-100 rounded-2xl rounded-tr-sm px-4 py-2.5"
          >
            <template v-for="(part, idx) in msg.parts" :key="idx">
              <pre
                v-if="part.type === 'text'"
                class="whitespace-pre-wrap font-sans text-sm"
                >{{ part.text }}</pre>
            </template>
          </div>
        </div>

        <!-- System Message -->
        <div v-else-if="msg.role === 'system'" class="flex justify-center">
          <div
            class="bg-slate-800/50 text-slate-400 text-xs px-3 py-1 rounded-full"
          >
            <template v-for="(part, idx) in msg.parts" :key="idx">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
            </template>
          </div>
        </div>

        <!-- Assistant Message -->
        <div v-else class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30"
            >
              <Sparkles class="w-3 h-3 text-cyan-400" />
            </div>
            <span class="text-xs font-medium text-slate-400">Agent</span>
            <span
              v-if="msg.status === 'interrupted'"
              class="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30"
              >已中断</span
            >
            <span
              v-if="msg.status === 'failed'"
              class="text-[10px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded border border-red-500/30"
              >失败</span
            >
          </div>

          <div class="flex flex-col gap-2 pl-8">
            <template v-for="(part, index) in msg.parts" :key="index">
              <!-- Text Part -->
              <div
                v-if="part.type === 'text' && part.text"
                class="bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed max-w-[95%]"
              >
                <pre class="whitespace-pre-wrap font-sans">{{ part.text }}</pre>
                <span
                  v-if="
                    msg.status === 'streaming' && index === msg.parts.length - 1
                  "
                  class="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse align-middle"
                ></span>
              </div>

              <!-- Tool Call Part -->
              <div
                v-else-if="part.type === 'tool'"
                class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 max-w-[95%]"
              >
                <div class="flex items-center gap-2 mb-1.5">
                  <Wrench class="w-3.5 h-3.5 text-slate-400" />
                  <span class="text-xs font-medium text-slate-300">{{
                    part.toolName
                  }}</span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
                    :class="{
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20':
                        part.status === 'running',
                      'bg-green-500/10 text-green-400 border border-green-500/20':
                        part.status === 'succeeded',
                      'bg-red-500/10 text-red-400 border border-red-500/20':
                        part.status === 'failed',
                    }"
                    >{{ part.status }}</span
                  >
                </div>
                <div v-if="part.summary" class="text-xs text-slate-500 pl-5">
                  {{ part.summary }}
                </div>
              </div>

              <!-- Confirmation Part -->
              <div
                v-else-if="part.type === 'confirmation'"
                class="bg-slate-800/80 border border-amber-600/50 rounded-lg p-3 max-w-[95%]"
              >
                <div class="flex items-center gap-2 mb-2">
                  <AlertCircle class="w-4 h-4 text-amber-500" />
                  <span class="text-sm font-medium text-amber-500"
                    >等待确认</span
                  >
                </div>
                <p class="text-xs text-slate-300 mb-3">
                  Agent 请求您的确认以继续操作。
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  class="w-full h-8 text-amber-400 border-amber-900/50 hover:bg-amber-950/50"
                  @click="openConfirmationDialog(part.confirmationId!)"
                  >查看详情</Button
                >
              </div>

              <!-- Execution Summary -->
              <div
                v-else-if="part.type === 'execution_summary'"
                class="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 max-w-[95%] flex items-start gap-2"
              >
                <FileCheck class="w-4 h-4 text-slate-400 mt-0.5" />
                <p class="text-xs text-slate-400 leading-relaxed">
                  {{ part.summary }}
                </p>
              </div>

              <!-- Error Part -->
              <div
                v-else-if="part.type === 'error'"
                class="bg-red-950/30 border border-red-900/50 rounded-lg p-3 max-w-[95%] flex items-start gap-2"
              >
                <XCircle class="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <div class="text-xs font-medium text-red-400 mb-0.5">
                    {{ part.code || 'Error' }}
                  </div>
                  <p class="text-xs text-red-300/80">{{ part.message }}</p>
                </div>
              </div>
            </template>

            <!-- Pending Indicator -->
            <div
              v-if="msg.status === 'pending'"
              class="flex items-center gap-1.5 h-10 px-4 bg-slate-800 rounded-2xl rounded-tl-sm w-fit"
            >
              <span
                class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"
              ></span>
              <span
                class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"
              ></span>
              <span
                class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
              ></span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Input Area -->
    <div
      class="p-4 border-t border-slate-800/50 bg-slate-900/80 backdrop-blur shrink-0"
    >
      <div
        class="relative bg-slate-950 border border-slate-800 rounded-xl focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all"
      >
        <textarea
          v-model="inputMessage"
          rows="1"
          maxlength="10000"
          placeholder="向 AI 助手发送消息..."
          class="w-full bg-transparent text-slate-200 text-sm px-4 py-3 resize-none focus:outline-none min-h-[44px] max-h-[100px] scrollbar-thin"
          @keydown="handleKeydown"
          @input="handleInput"
          :disabled="isSending || !!conversation?.activeRunId"
        ></textarea>

        <div class="absolute right-2 bottom-2">
          <Button
            size="sm"
            class="h-7 w-7 p-0 rounded-lg"
            :class="
              inputMessage.trim() && !isSending && !conversation?.activeRunId
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed hover:bg-slate-800'
            "
            @click="handleSend"
            :disabled="
              !inputMessage.trim() || isSending || !!conversation?.activeRunId
            "
          >
            <Loader2 v-if="isSending" class="w-3.5 h-3.5 animate-spin" />
            <Send
              v-else
              class="w-3.5 h-3.5"
              :class="inputMessage.trim() ? 'ml-0.5' : ''"
            />
          </Button>
        </div>
      </div>
      <div class="flex justify-between items-center mt-2 px-1">
        <span class="text-[10px] text-slate-500 flex items-center gap-1">
          <Info class="w-3 h-3" />
          Shift + Enter 换行
        </span>
        <span
          class="text-[10px]"
          :class="
            inputMessage.length > 9000 ? 'text-amber-500' : 'text-slate-600'
          "
        >
          {{ inputMessage.length }} / 10000
        </span>
      </div>
    </div>

    <!-- Confirmation Detail Dialog -->
    <Dialog v-model:open="confirmationDialogOpen">
      <DialogContent
        class="bg-slate-900 border-slate-700 text-slate-100 max-w-md"
      >
        <DialogHeader>
          <DialogTitle class="text-slate-100 flex items-center gap-2">
            <AlertCircle class="w-5 h-5 text-amber-500" />
            确认操作
          </DialogTitle>
          <DialogDescription class="text-slate-400">
            请确认以下 Agent 操作是否继续执行
          </DialogDescription>
        </DialogHeader>

        <div v-if="isLoadingConfirmation" class="py-8 flex justify-center">
          <Loader2 class="w-6 h-6 text-slate-400 animate-spin" />
        </div>

        <div v-else-if="confirmationDetail" class="space-y-4">
          <!-- Action type -->
          <div class="bg-slate-800/60 rounded-lg p-3 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-400">操作类型</span>
              <span
                class="text-xs font-medium px-2 py-0.5 rounded-full"
                :class="
                  confirmationDetail.action === 'apply_brief_patch'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                "
              >
                {{
                  confirmationDetail.action === 'apply_brief_patch'
                    ? '修改需求文档'
                    : '生成图片'
                }}
              </span>
            </div>
          </div>

          <!-- Estimated fee (if any) -->
          <div
            v-if="confirmationDetail.estimatedFee"
            class="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3"
          >
            <div class="text-xs text-amber-400 font-medium mb-1">预计费用</div>
            <div class="text-sm text-amber-300">
              {{
                (confirmationDetail.estimatedFee.maxAmountMinor / 100).toFixed(
                  2,
                )
              }}
              {{ confirmationDetail.estimatedFee.currency }}
            </div>
            <div class="text-xs text-amber-500/70 mt-1">批准后将预留该额度</div>
          </div>

          <!-- Expiry -->
          <div class="text-xs text-slate-500 flex items-center gap-1">
            <span>有效期至</span>
            <span class="text-slate-400">{{
              new Date(confirmationDetail.expiresAt).toLocaleString('zh-CN')
            }}</span>
          </div>

          <!-- Status indicator -->
          <div
            v-if="confirmationDetail.status !== 'pending'"
            class="bg-slate-800/40 rounded-lg p-3 text-center text-sm"
            :class="{
              'text-green-400': confirmationDetail.status === 'approved',
              'text-red-400': confirmationDetail.status === 'rejected',
              'text-slate-400': confirmationDetail.status === 'expired',
            }"
          >
            {{
              confirmationDetail.status === 'approved'
                ? '✓ 已批准'
                : confirmationDetail.status === 'rejected'
                  ? '✗ 已拒绝'
                  : '⏰ 已过期'
            }}
          </div>
        </div>

        <DialogFooter
          v-if="confirmationDetail?.status === 'pending'"
          class="gap-2 sm:gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            class="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            :disabled="isRejecting || isApproving"
            @click="handleReject"
          >
            <Loader2
              v-if="isRejecting"
              class="w-3.5 h-3.5 mr-1.5 animate-spin"
            />
            拒绝
          </Button>
          <Button
            size="sm"
            class="bg-amber-600 hover:bg-amber-500 text-white"
            :disabled="isApproving || isRejecting"
            @click="handleApprove"
          >
            <Loader2
              v-if="isApproving"
              class="w-3.5 h-3.5 mr-1.5 animate-spin"
            />
            批准执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
