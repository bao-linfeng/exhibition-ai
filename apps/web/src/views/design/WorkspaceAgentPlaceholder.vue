<script setup lang="ts">
import { MessageSquare, Sparkles } from '@lucide/vue';
</script>

<template>
  <div class="h-full flex flex-col p-4 bg-slate-900/30">
    <div class="flex items-center gap-2 mb-6">
      <MessageSquare class="w-5 h-5 text-slate-100" />
      <h3 class="font-semibold text-slate-100">AI 设计助手</h3>
    </div>

    <div
      class="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-700 rounded-xl bg-slate-900/50"
    >
      <div
        class="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4"
      >
        <Sparkles class="w-6 h-6 text-cyan-500" />
      </div>

      <h4 class="text-base font-medium text-slate-200 mb-2">
        Agent 功能即将上线
      </h4>

      <p class="text-sm text-slate-400 mb-6 max-w-[200px]">
        (T024 版本更新) <br />
        多轮对话修改、自动排版等智能体功能正在开发中。
      </p>

      <div class="text-xs text-slate-500 bg-slate-800 px-3 py-1.5 rounded-full">
        Coming Soon
      </div>
    </div>
  </div>
</template>
