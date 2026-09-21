<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { getQuotaOptions, useTopupQuota } from '@/api/queries/settings.js';
import { Button } from '@/components/ui/button/index.js';
import { Loader2, Plus, Wallet, ShieldAlert, CheckCircle2 } from '@lucide/vue';
import { useToast } from '@/components/ui/toast/index.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog/index.js';
import { Label } from '@/components/ui/label/index.js';
import { Input } from '@/components/ui/input/index.js';
import { Card } from '@/components/ui/card/index.js';

const { toast } = useToast();

const {
  data: quotaResponse,
  isLoading,
  isError,
  error,
} = useQuery(getQuotaOptions());

const quota = computed(() => quotaResponse.value?.data);

const topupMutation = useTopupQuota();

const isTopupDialogOpen = ref(false);
const topupForm = ref({
  amount: 100,
  reason: '管理员充值',
});

function openTopupDialog() {
  topupForm.value = {
    amount: 100,
    reason: '管理员充值',
  };
  isTopupDialogOpen.value = true;
}

async function handleTopup() {
  if (topupForm.value.amount <= 0) {
    toast({ title: '充值金额必须大于0', variant: 'destructive' });
    return;
  }

  const amountStr = topupForm.value.amount.toString();
  const [integerPart, fractionalPart = ''] = amountStr.split('.');

  if (fractionalPart.length > 2) {
    toast({ title: '充值金额最多只能包含两位小数', variant: 'destructive' });
    return;
  }

  const paddedFractionalPart = fractionalPart.padEnd(2, '0');
  const amountMinor = parseInt(integerPart + paddedFractionalPart, 10);

  try {
    await topupMutation.mutateAsync({
      ownerType: 'system',
      amountMinor,
      currency: 'CNY',
      reason: topupForm.value.reason,
    });
    toast({ title: '充值成功' });
    isTopupDialogOpen.value = false;
  } catch (err: unknown) {
    toast({
      title: '充值失败',
      variant: 'destructive',
      description: err instanceof Error ? err.message : '未知错误',
    });
  }
}

function formatAmount(minor: number | undefined) {
  if (minor === undefined) return '-';
  return (minor / 100).toFixed(2);
}
</script>

<template>
  <div class="h-full flex flex-col space-y-6 max-w-4xl mx-auto w-full pt-4">
    <div v-if="isLoading" class="flex justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="isError" class="text-destructive text-center py-12">
      加载失败: {{ error?.message }}
    </div>

    <template v-else-if="quota">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          class="p-6 flex flex-col items-center justify-center text-center space-y-2 border-blue-200 bg-blue-50/30 dark:bg-blue-950/10"
        >
          <Wallet class="w-8 h-8 text-blue-500 mb-2" />
          <div class="text-sm font-medium text-muted-foreground">
            账户总余额
          </div>
          <div class="text-3xl font-bold text-foreground">
            {{ formatAmount(quota.balanceMinor) }}
            <span class="text-base font-normal text-muted-foreground">CNY</span>
          </div>
        </Card>

        <Card
          class="p-6 flex flex-col items-center justify-center text-center space-y-2 border-green-200 bg-green-50/30 dark:bg-green-950/10"
        >
          <CheckCircle2 class="w-8 h-8 text-green-500 mb-2" />
          <div class="text-sm font-medium text-muted-foreground">可用余额</div>
          <div class="text-3xl font-bold text-foreground">
            {{ formatAmount(quota.availableMinor) }}
            <span class="text-base font-normal text-muted-foreground">CNY</span>
          </div>
        </Card>

        <Card
          class="p-6 flex flex-col items-center justify-center text-center space-y-2 border-orange-200 bg-orange-50/30 dark:bg-orange-950/10"
        >
          <ShieldAlert class="w-8 h-8 text-orange-500 mb-2" />
          <div class="text-sm font-medium text-muted-foreground">
            处理中(已预占)
          </div>
          <div class="text-3xl font-bold text-foreground">
            {{ formatAmount(quota.reservedMinor) }}
            <span class="text-base font-normal text-muted-foreground">CNY</span>
          </div>
        </Card>
      </div>

      <div class="flex justify-center mt-8">
        <Button
          size="lg"
          class="w-full md:w-auto px-12"
          @click="openTopupDialog"
        >
          <Plus class="w-5 h-5 mr-2" />
          系统额度充值
        </Button>
      </div>
    </template>

    <Dialog v-model:open="isTopupDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>系统额度充值</DialogTitle>
          <DialogDescription>
            为系统账户增加额度，输入金额单位为元。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">充值金额 (元)</Label>
            <div class="col-span-3">
              <Input
                type="number"
                v-model.number="topupForm.amount"
                min="0.01"
                step="0.01"
              />
            </div>
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">充值原因</Label>
            <div class="col-span-3">
              <Input
                type="text"
                v-model="topupForm.reason"
                placeholder="如：测试充值"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="isTopupDialogOpen = false"
            :disabled="topupMutation.isPending.value"
          >
            取消
          </Button>
          <Button
            @click="handleTopup"
            :disabled="topupMutation.isPending.value"
          >
            <Loader2
              v-if="topupMutation.isPending.value"
              class="mr-2 h-4 w-4 animate-spin"
            />
            确认充值
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
