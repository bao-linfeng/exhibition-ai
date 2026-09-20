<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useDirectionsQuery } from '@/api/queries/directions';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CreateGenerationRequest } from '@exhibition/contracts';

interface Props {
  projectId: string;
  mode: 'generate' | 'edit';
  briefRevisionId: string;
  directionId?: string;
  parentVersionId?: string;
  currentBriefRevisionId?: string;
  projectRevision: number;
  modelConfigId?: string;
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [request: CreateGenerationRequest];
  cancel: [];
}>();

const instruction = ref('');
const selectedModelConfigId = ref(props.modelConfigId || '');
const count = ref('1');
const sizePreset = ref<
  | 'landscape_4_3'
  | 'landscape_16_9'
  | 'square_1_1'
  | 'portrait_3_4'
  | 'portrait_9_16'
>('landscape_4_3');
const seed = ref<number | undefined>(undefined);
const negativePrompt = ref('');
const acknowledgeBriefChange = ref(false);

const selectedDirectionId = ref<string>('');

const shouldFetchDirections = computed(
  () => props.mode === 'generate' && !props.directionId
);

const { data: directionsResponse, isLoading: directionsLoading } = useDirectionsQuery(
  () => props.projectId,
  computed(() => shouldFetchDirections.value ? props.briefRevisionId : undefined)
);

const directions = computed(() => directionsResponse.value?.data ?? []);

watch(
  directions,
  (newDirections) => {
    if (newDirections.length > 0 && !selectedDirectionId.value) {
      selectedDirectionId.value = newDirections[0]!.id;
    }
  },
  { immediate: true }
);

const effectiveDirectionId = computed(() => props.directionId ?? selectedDirectionId.value);

const { data: modelsResponse, isLoading: modelsLoading } = useQuery({
  queryKey: ['models'],
  queryFn: async () => {
    const { data, error } = await apiClient.GET('/api/v1/models');
    if (error) throw new Error('Failed to fetch models');
    return data;
  },
});

const models = computed(() => modelsResponse.value?.data ?? []);

watch(
  () => models.value,
  (newModels) => {
    if (newModels.length > 0 && !selectedModelConfigId.value) {
      if (props.modelConfigId) {
        selectedModelConfigId.value = props.modelConfigId;
      } else if (newModels.length === 1) {
        selectedModelConfigId.value = newModels[0]!.id;
      }
    }
  },
  { immediate: true },
);

const selectedModel = computed(() => {
  return models.value.find((m) => m.id === selectedModelConfigId.value);
});

const selectedModelSupportsEdit = computed(() => {
  return selectedModel.value?.capabilities?.includes('edit') ?? false;
});

// 检测 Brief 是否发生变化
const briefChanged = computed(() => {
  return (
    props.mode === 'edit' &&
    props.currentBriefRevisionId &&
    props.briefRevisionId !== props.currentBriefRevisionId
  );
});

const canSubmit = computed(() => {
  if (!instruction.value.trim()) return false;
  if (!selectedModelConfigId.value) return false;
  if (props.mode === 'generate' && !effectiveDirectionId.value) return false;
  if (props.mode === 'edit' && !props.parentVersionId) return false;
  // 如果 Brief 变化了，必须显式确认
  if (briefChanged.value && !acknowledgeBriefChange.value) return false;
  return true;
});

function handleSubmit() {
  if (!canSubmit.value) return;

  const baseRequest = {
    briefRevisionId: props.briefRevisionId,
    instruction: instruction.value.trim(),
    modelConfigId: selectedModelConfigId.value,
    parameters: {
      count: parseInt(count.value, 10),
      sizePreset: sizePreset.value,
      ...(seed.value !== undefined && { seed: seed.value }),
      ...(negativePrompt.value.trim() && {
        negativePrompt: negativePrompt.value.trim(),
      }),
    },
    expectedProjectRevision: props.projectRevision,
  };

  if (props.mode === 'generate') {
    emit('submit', {
      ...baseRequest,
      mode: 'generate',
      directionId: effectiveDirectionId.value!,
      parentVersionId: null,
    } as CreateGenerationRequest);
  } else {
    emit('submit', {
      ...baseRequest,
      mode: 'edit',
      parentVersionId: props.parentVersionId!,
      ...(props.directionId && { directionId: props.directionId }),
      ...(briefChanged.value && {
        acknowledgeBriefChange: acknowledgeBriefChange.value,
      }),
    } as CreateGenerationRequest);
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="handleSubmit">
    <div v-if="briefChanged" class="space-y-2">
      <Alert variant="warning">
        <AlertDescription>
          需求已更新，基于旧需求的父图修改可能产生不一致结果。
        </AlertDescription>
      </Alert>
      <div class="flex items-center space-x-2">
        <input
          id="acknowledge-brief-change"
          v-model="acknowledgeBriefChange"
          type="checkbox"
          class="h-4 w-4"
        />
        <Label for="acknowledge-brief-change" class="text-sm font-normal">
          我已知晓需求变更，仍要继续修改此图片
        </Label>
      </div>
    </div>

    <div v-if="mode === 'generate' && !directionId" class="space-y-2">
      <Label for="direction-select">
        设计方向 <span class="text-red-500">*</span>
      </Label>
      <div v-if="!directionsLoading && directions.length === 0" class="text-sm text-amber-400 p-2 bg-amber-950/40 rounded border border-amber-800">
        请先生成设计方向
      </div>
      <Select
        v-else
        v-model="selectedDirectionId"
        :disabled="disabled || directionsLoading"
      >
        <SelectTrigger id="direction-select">
          <SelectValue :placeholder="directionsLoading ? '加载中...' : '选择设计方向'" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="dir in directions"
            :key="dir.id"
            :value="dir.id"
          >
            {{ dir.title || (dir.concept.length > 40 ? dir.concept.substring(0, 40) + '...' : dir.concept) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-2">
      <Label for="instruction">
        {{ mode === 'generate' ? '生成指令' : '修改指令' }}
        <span class="text-red-500">*</span>
      </Label>
      <Textarea
        id="instruction"
        v-model="instruction"
        :placeholder="
          mode === 'generate'
            ? '描述您想要生成的图片内容...'
            : '描述您想要如何修改这张图片...'
        "
        :disabled="disabled"
        :rows="4"
        :maxlength="2000"
        class="resize-none"
      />
      <p class="text-xs text-muted-foreground">{{ instruction.length }}/2000</p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2">
        <Label for="model-config">
          模型配置 <span class="text-red-500">*</span>
        </Label>
        <Select
          v-model="selectedModelConfigId"
          :disabled="disabled || modelsLoading"
        >
          <SelectTrigger id="model-config">
            <SelectValue
              :placeholder="modelsLoading ? '加载中...' : '选择模型'"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="model in models"
              :key="model.id"
              :value="model.id"
            >
              {{ model.displayName }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p
          v-if="mode === 'edit' && selectedModel && !selectedModelSupportsEdit"
          class="text-xs text-amber-600"
        >
          该模型不支持图片编辑
        </p>
      </div>

      <div class="space-y-2">
        <Label for="count">生成数量</Label>
        <Select v-model="count" :disabled="disabled">
          <SelectTrigger id="count">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 张</SelectItem>
            <SelectItem value="2">2 张</SelectItem>
            <SelectItem value="3">3 张</SelectItem>
            <SelectItem value="4">4 张</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="space-y-2">
      <Label for="size-preset">尺寸预设</Label>
      <Select v-model="sizePreset" :disabled="disabled">
        <SelectTrigger id="size-preset">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="landscape_4_3">横向 4:3</SelectItem>
          <SelectItem value="landscape_16_9">横向 16:9</SelectItem>
          <SelectItem value="square_1_1">方形 1:1</SelectItem>
          <SelectItem value="portrait_3_4">纵向 3:4</SelectItem>
          <SelectItem value="portrait_9_16">纵向 9:16</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2">
        <Label for="seed">随机种子（可选）</Label>
        <Input
          id="seed"
          v-model.number="seed"
          type="number"
          min="0"
          :disabled="disabled"
          placeholder="留空随机生成"
        />
      </div>

      <div class="space-y-2">
        <Label for="negative-prompt">负面提示词（可选）</Label>
        <Input
          id="negative-prompt"
          v-model="negativePrompt"
          :disabled="disabled"
          placeholder="不希望出现的内容"
          maxlength="1000"
        />
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-4">
      <Button type="button" variant="outline" @click="emit('cancel')">
        取消
      </Button>
      <Button type="submit" :disabled="!canSubmit || disabled">
        {{ mode === 'generate' ? '开始生成' : '确认修改' }}
      </Button>
    </div>
  </form>
</template>
