<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  listModelConfigsOptions,
  useUpdateModelConfig,
} from '@/api/queries/settings.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table/index.js';
import { Badge } from '@/components/ui/badge/index.js';
import { Button } from '@/components/ui/button/index.js';
import { Loader2, Edit2 } from '@lucide/vue';
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
import type { ModelConfig } from '@exhibition/contracts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select/index.js';

const { toast } = useToast();

const {
  data: modelsResponse,
  isLoading,
  isError,
  error,
} = useQuery(listModelConfigsOptions());

const models = computed(() => modelsResponse.value?.data ?? []);

const updateModel = useUpdateModelConfig();

const isEditDialogOpen = ref(false);
const editingModel = ref<ModelConfig | null>(null);
const editForm = ref<{
  isActive: string;
  maxConcurrent: number;
  costPerImageMinor: number;
}>({
  isActive: 'true',
  maxConcurrent: 1,
  costPerImageMinor: 0,
});

function openEditDialog(model: ModelConfig) {
  editingModel.value = model;
  editForm.value = {
    isActive: model.isActive ? 'true' : 'false',
    maxConcurrent: model.maxConcurrent,
    costPerImageMinor: model.costPerImageMinor,
  };
  isEditDialogOpen.value = true;
}

async function handleUpdateModel() {
  if (!editingModel.value) return;

  try {
    await updateModel.mutateAsync({
      id: editingModel.value.id,
      body: {
        isActive: editForm.value.isActive === 'true',
        maxConcurrent: editForm.value.maxConcurrent,
        costPerImageMinor: editForm.value.costPerImageMinor,
      },
    });
    toast({ title: '模型配置更新成功' });
    isEditDialogOpen.value = false;
  } catch (err: unknown) {
    toast({
      title: '更新失败',
      variant: 'destructive',
      description: err instanceof Error ? err.message : '未知错误',
    });
  }
}
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
    <div
      class="rounded-md border bg-card shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div class="overflow-auto flex-1 relative">
        <Table>
          <TableHeader class="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow>
              <TableHead>模型名称</TableHead>
              <TableHead>提供商</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>并发数</TableHead>
              <TableHead>单张费用</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="isLoading">
              <TableCell colspan="6" class="h-32 text-center">
                <div
                  class="flex items-center justify-center text-muted-foreground"
                >
                  <Loader2 class="h-5 w-5 animate-spin mr-2" />
                  加载中...
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="isError">
              <TableCell colspan="6" class="h-32 text-center text-destructive">
                加载失败: {{ error?.message }}
              </TableCell>
            </TableRow>
            <TableRow v-else-if="models.length === 0">
              <TableCell
                colspan="6"
                class="h-32 text-center text-muted-foreground"
              >
                没有找到模型配置
              </TableCell>
            </TableRow>
            <TableRow
              v-for="model in models"
              :key="model.id"
              class="hover:bg-muted/30"
              :class="{ 'opacity-60': !model.isActive }"
            >
              <TableCell class="font-medium">
                <div>{{ model.displayName }}</div>
                <div class="text-xs text-muted-foreground font-normal">
                  {{ model.modelId }}
                </div>
              </TableCell>
              <TableCell>{{ model.providerId }}</TableCell>
              <TableCell>
                <Badge
                  :variant="model.isActive ? 'default' : 'outline'"
                  :class="
                    model.isActive
                      ? 'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20 border'
                      : 'border border-slate-500/20 text-slate-500'
                  "
                >
                  {{ model.isActive ? '已启用' : '已禁用' }}
                </Badge>
              </TableCell>
              <TableCell>{{ model.maxConcurrent }}</TableCell>
              <TableCell
                >{{ (model.costPerImageMinor / 100).toFixed(2) }}
                {{ model.currency || 'CNY' }}</TableCell
              >
              <TableCell class="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  @click="openEditDialog(model)"
                >
                  <Edit2 class="w-4 h-4 mr-1" />
                  配置
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <Dialog v-model:open="isEditDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑模型配置</DialogTitle>
          <DialogDescription>
            修改模型 {{ editingModel?.displayName }} 的参数。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">状态</Label>
            <div class="col-span-3">
              <Select v-model="editForm.isActive">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">启用</SelectItem>
                  <SelectItem value="false">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">最大并发数</Label>
            <div class="col-span-3">
              <Input
                type="number"
                v-model.number="editForm.maxConcurrent"
                min="1"
              />
            </div>
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">单张费用 (分)</Label>
            <div class="col-span-3">
              <Input
                type="number"
                v-model.number="editForm.costPerImageMinor"
                min="0"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="isEditDialogOpen = false"
            :disabled="updateModel.isPending.value"
          >
            取消
          </Button>
          <Button
            @click="handleUpdateModel"
            :disabled="updateModel.isPending.value"
          >
            <Loader2
              v-if="updateModel.isPending.value"
              class="mr-2 h-4 w-4 animate-spin"
            />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
