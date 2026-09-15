<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useBriefQuery,
  useUpdateBriefMutation,
} from '../../api/queries/briefs.js';
import { useProjectQuery } from '../../api/queries/projects.js';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Input } from '../../components/ui/input/index.js';
import { Label } from '../../components/ui/label/index.js';
import {
  ChevronRight,
  Plus,
  Trash2,
  Maximize,
  Palette,
  LayoutTemplate,
  Shapes,
  FileText,
  AlertCircle,
} from '@lucide/vue';
import type { paths } from '@exhibition/api-client';

type BriefContent =
  paths['/api/v1/projects/{projectId}/brief']['put']['requestBody']['content']['application/json']['content'];
type BoothOpenSide = 'front' | 'right' | 'back' | 'left';

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id as string);

const { data: project, isLoading: isLoadingProject } = useProjectQuery(
  projectId.value,
);
const { data: brief, isLoading: isLoadingBrief } = useBriefQuery(
  projectId.value,
);
const updateMutation = useUpdateBriefMutation();

const conflictError = ref(false);

const areaTypeOptions = [
  { value: 'reception', label: '前台接待' },
  { value: 'meeting', label: '洽谈区' },
  { value: 'display', label: '展示区' },
  { value: 'storage', label: '储物区' },
  { value: 'led', label: 'LED屏' },
  { value: 'demo', label: '演示区' },
];

const openSideOptions = [
  { value: 'front', label: '正面' },
  { value: 'right', label: '右侧' },
  { value: 'back', label: '背面' },
  { value: 'left', label: '左侧' },
];

const formData = ref<BriefContent>({
  booth: {
    widthM: 0,
    depthM: 0,
    heightLimitM: 0,
    openSides: ['front'],
    hallRestrictions: '',
  },
  brand: {
    name: '',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    visualKeywords: [],
  },
  functionalAreas: [
    { type: 'reception', required: true, quantity: 1, description: '' },
  ],
  style: {
    keywords: [],
    materials: [],
    forbiddenElements: [],
  },
  budget: {
    amountMinor: 0,
    currency: 'CNY',
  },
  deadline: '',
  specialRequirements: '',
});

const budgetYuan = computed({
  get: () =>
    formData.value.budget?.amountMinor
      ? formData.value.budget.amountMinor / 100
      : undefined,
  set: (val) => {
    if (!formData.value.budget)
      formData.value.budget = { amountMinor: 0, currency: 'CNY' };
    if (val !== undefined && val !== null) {
      formData.value.budget.amountMinor = Math.round(val * 100);
    } else {
      formData.value.budget = undefined;
    }
  },
});

const area = computed(() => {
  return (formData.value.booth.widthM * formData.value.booth.depthM).toFixed(2);
});

// Dynamic lists helpers
const visualKeywordInput = ref('');
function addVisualKeyword() {
  if (!visualKeywordInput.value.trim()) return;
  if (!formData.value.brand.visualKeywords)
    formData.value.brand.visualKeywords = [];
  if (formData.value.brand.visualKeywords.length >= 10) return;
  formData.value.brand.visualKeywords.push(visualKeywordInput.value.trim());
  visualKeywordInput.value = '';
}
function removeVisualKeyword(index: number) {
  formData.value.brand.visualKeywords?.splice(index, 1);
}

const styleKeywordInput = ref('');
function addStyleKeyword() {
  if (!styleKeywordInput.value.trim()) return;
  if (formData.value.style.keywords.length >= 20) return;
  formData.value.style.keywords.push(styleKeywordInput.value.trim());
  styleKeywordInput.value = '';
}
function removeStyleKeyword(index: number) {
  formData.value.style.keywords.splice(index, 1);
}

const materialInput = ref('');
function addMaterial() {
  if (!materialInput.value.trim()) return;
  if (!formData.value.style.materials) formData.value.style.materials = [];
  if (formData.value.style.materials.length >= 20) return;
  formData.value.style.materials.push(materialInput.value.trim());
  materialInput.value = '';
}
function removeMaterial(index: number) {
  formData.value.style.materials?.splice(index, 1);
}

const forbiddenInput = ref('');
function addForbidden() {
  if (!forbiddenInput.value.trim()) return;
  if (!formData.value.style.forbiddenElements)
    formData.value.style.forbiddenElements = [];
  if (formData.value.style.forbiddenElements.length >= 20) return;
  formData.value.style.forbiddenElements.push(forbiddenInput.value.trim());
  forbiddenInput.value = '';
}
function removeForbidden(index: number) {
  formData.value.style.forbiddenElements?.splice(index, 1);
}

function addArea() {
  if (formData.value.functionalAreas.length >= 20) return;
  formData.value.functionalAreas.push({
    type: 'reception',
    required: false,
    quantity: 1,
    description: '',
  });
}
function removeArea(index: number) {
  formData.value.functionalAreas.splice(index, 1);
  if (formData.value.functionalAreas.length === 0) {
    addArea();
  }
}

watch(
  brief,
  (newVal) => {
    if (newVal && !updateMutation.isPending.value && !conflictError.value) {
      // deep clone to avoid mutating query cache
      formData.value = JSON.parse(JSON.stringify(newVal.content));
    }
  },
  { immediate: true },
);

function toggleOpenSide(side: string) {
  const idx = formData.value.booth.openSides.indexOf(side as BoothOpenSide);
  if (idx > -1) {
    if (formData.value.booth.openSides.length > 1) {
      formData.value.booth.openSides.splice(idx, 1);
    }
  } else {
    if (formData.value.booth.openSides.length < 4) {
      formData.value.booth.openSides.push(side as BoothOpenSide);
    }
  }
}

async function save() {
  conflictError.value = false;
  if (formData.value.style.keywords.length === 0) {
    alert('请至少添加一个风格关键词');
    return;
  }

  try {
    await updateMutation.mutateAsync({
      projectId: projectId.value,
      body: {
        content: formData.value,
        expectedRevision: project.value?.revision || 0,
      },
    });
    router.push(`/projects/${projectId.value}/brief`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'conflict') {
      conflictError.value = true;
    } else {
      console.error('Failed to update brief', err);
    }
  }
}

function cancel() {
  router.push(`/projects/${projectId.value}/brief`);
}

function reloadPage() {
  window.location.reload();
}
</script>

<template>
  <div
    v-if="isLoadingProject || isLoadingBrief"
    class="flex justify-center p-12"
  >
    <div
      class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
    />
  </div>

  <div v-else-if="project">
    <div class="mb-4 flex items-center text-sm text-muted-foreground">
      <button
        class="hover:text-foreground transition-colors"
        @click="router.push('/projects')"
      >
        项目管理
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <button
        class="hover:text-foreground transition-colors"
        @click="router.push(`/projects/${projectId}`)"
      >
        {{ project.name }}
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <button class="hover:text-foreground transition-colors" @click="cancel">
        Brief
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <span class="text-foreground font-medium">编辑</span>
    </div>

    <PageHeader :title="brief ? '编辑 Brief' : '创建 Brief'" />

    <div
      v-if="conflictError"
      class="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-3"
    >
      <AlertCircle class="w-5 h-5 mt-0.5" />
      <div>
        <h4 class="font-medium">内容冲突</h4>
        <p class="text-sm mt-1">
          项目内容已被他人修改。您当前的输入已保留，请刷新页面获取最新状态后重新尝试保存。
        </p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3 border-red-200 hover:bg-red-100"
          @click="reloadPage"
          >刷新页面</Button
        >
      </div>
    </div>

    <form class="space-y-8 pb-16" @submit.prevent="save">
      <!-- 展台规格 -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
      >
        <div class="p-4 border-b bg-muted/20 flex items-center gap-2">
          <Maximize class="h-5 w-5 text-primary" />
          <h3 class="font-semibold text-lg">展台规格</h3>
        </div>
        <div class="p-6 grid gap-6 md:grid-cols-3">
          <div class="space-y-2">
            <Label>宽度 (m) <span class="text-destructive">*</span></Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              v-model="formData.booth.widthM"
              required
            />
          </div>
          <div class="space-y-2">
            <Label>深度 (m) <span class="text-destructive">*</span></Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              v-model="formData.booth.depthM"
              required
            />
          </div>
          <div class="space-y-2">
            <Label>面积 (m²)</Label>
            <div
              class="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              {{ area }}
            </div>
          </div>
          <div class="space-y-2">
            <Label>限高 (m) <span class="text-destructive">*</span></Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              v-model="formData.booth.heightLimitM"
              required
            />
          </div>

          <div class="space-y-2 md:col-span-2">
            <Label
              >开放面 (1-4个) <span class="text-destructive">*</span></Label
            >
            <div class="flex flex-wrap gap-4 pt-1.5">
              <label
                v-for="opt in openSideOptions"
                :key="opt.value"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  :checked="
                    formData.booth.openSides.includes(
                      opt.value as BoothOpenSide,
                    )
                  "
                  :disabled="
                    formData.booth.openSides.length === 1 &&
                    formData.booth.openSides.includes(
                      opt.value as BoothOpenSide,
                    )
                  "
                  @change="toggleOpenSide(opt.value)"
                />
                <span class="text-sm font-medium">{{ opt.label }}</span>
              </label>
            </div>
          </div>

          <div class="space-y-2 md:col-span-3">
            <Label>展馆特殊限制</Label>
            <textarea
              v-model="formData.booth.hallRestrictions"
              class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="展馆对展台搭建的特殊要求或限制..."
            />
          </div>
        </div>
      </div>

      <!-- 品牌与视觉 -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
      >
        <div class="p-4 border-b bg-muted/20 flex items-center gap-2">
          <Palette class="h-5 w-5 text-primary" />
          <h3 class="font-semibold text-lg">品牌与视觉</h3>
        </div>
        <div class="p-6 grid gap-6 md:grid-cols-2">
          <div class="space-y-2 md:col-span-2">
            <Label>品牌名称 <span class="text-destructive">*</span></Label>
            <Input
              v-model="formData.brand.name"
              required
              maxlength="120"
              placeholder="参展品牌名称"
            />
          </div>

          <div class="space-y-2">
            <Label>主品牌色</Label>
            <div class="flex gap-2">
              <input
                type="color"
                v-model="formData.brand.primaryColor"
                class="h-10 w-12 rounded border p-1 cursor-pointer"
              />
              <Input
                v-model="formData.brand.primaryColor"
                class="flex-1 uppercase font-mono"
                placeholder="#000000"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label>辅助色</Label>
            <div class="flex gap-2">
              <input
                type="color"
                v-model="formData.brand.secondaryColor"
                class="h-10 w-12 rounded border p-1 cursor-pointer"
              />
              <Input
                v-model="formData.brand.secondaryColor"
                class="flex-1 uppercase font-mono"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          <div class="space-y-2 md:col-span-2">
            <Label>视觉关键词 (最多10个)</Label>
            <div class="flex gap-2 mb-2">
              <Input
                v-model="visualKeywordInput"
                @keydown.enter.prevent="addVisualKeyword"
                placeholder="输入关键词后按回车或点击添加"
                maxlength="40"
              />
              <Button
                type="button"
                variant="secondary"
                @click="addVisualKeyword"
                >添加</Button
              >
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(kw, idx) in formData.brand.visualKeywords || []"
                :key="idx"
                class="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
              >
                {{ kw }}
                <button
                  type="button"
                  @click="removeVisualKeyword(idx)"
                  class="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 功能区划 -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
      >
        <div class="p-4 border-b bg-muted/20 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <LayoutTemplate class="h-5 w-5 text-primary" />
            <h3 class="font-semibold text-lg">功能区划</h3>
          </div>
          <Button type="button" size="sm" variant="outline" @click="addArea">
            <Plus class="w-4 h-4 mr-1" /> 添加区域
          </Button>
        </div>
        <div class="p-6 space-y-4">
          <div
            v-for="(area, idx) in formData.functionalAreas"
            :key="idx"
            class="p-4 border rounded-lg bg-card flex flex-col gap-4 relative pr-10"
          >
            <button
              type="button"
              @click="removeArea(idx)"
              class="absolute right-4 top-4 text-muted-foreground hover:text-destructive"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="space-y-2">
                <Label>区域类型</Label>
                <select
                  v-model="area.type"
                  class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                >
                  <option
                    v-for="opt in areaTypeOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-2">
                <Label>数量</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  v-model="area.quantity"
                />
              </div>
              <div
                class="space-y-2 flex items-center h-full pt-6 md:col-span-2"
              >
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="area.required"
                    class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span class="text-sm font-medium">必须包含 (Required)</span>
                </label>
              </div>
            </div>
            <div class="space-y-2">
              <Label>要求说明</Label>
              <Input
                v-model="area.description"
                placeholder="对该区域的特定要求或面积建议"
                maxlength="500"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 风格偏好 -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
      >
        <div class="p-4 border-b bg-muted/20 flex items-center gap-2">
          <Shapes class="h-5 w-5 text-primary" />
          <h3 class="font-semibold text-lg">风格偏好</h3>
        </div>
        <div class="p-6 grid gap-8 md:grid-cols-2">
          <div class="space-y-2 md:col-span-2">
            <Label
              >设计风格关键词 (至少1个, 最多20个)
              <span class="text-destructive">*</span></Label
            >
            <div class="flex gap-2 mb-2">
              <Input
                v-model="styleKeywordInput"
                @keydown.enter.prevent="addStyleKeyword"
                placeholder="例如：现代、极简、科技感"
                maxlength="80"
              />
              <Button type="button" variant="secondary" @click="addStyleKeyword"
                >添加</Button
              >
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(kw, idx) in formData.style.keywords"
                :key="idx"
                class="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm border border-primary/20"
              >
                {{ kw }}
                <button
                  type="button"
                  @click="removeStyleKeyword(idx)"
                  class="text-primary hover:text-primary/70"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label>材质偏好</Label>
            <div class="flex gap-2 mb-2">
              <Input
                v-model="materialInput"
                @keydown.enter.prevent="addMaterial"
                placeholder="例如：木纹、拉丝金属"
                maxlength="80"
              />
              <Button type="button" variant="secondary" @click="addMaterial"
                >添加</Button
              >
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(m, idx) in formData.style.materials || []"
                :key="idx"
                class="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
              >
                {{ m }}
                <button
                  type="button"
                  @click="removeMaterial(idx)"
                  class="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label>禁用元素</Label>
            <div class="flex gap-2 mb-2">
              <Input
                v-model="forbiddenInput"
                @keydown.enter.prevent="addForbidden"
                placeholder="绝对不要出现的元素或材质"
                maxlength="80"
              />
              <Button type="button" variant="secondary" @click="addForbidden"
                >添加</Button
              >
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(f, idx) in formData.style.forbiddenElements || []"
                :key="idx"
                class="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-md text-sm border border-red-200"
              >
                {{ f }}
                <button
                  type="button"
                  @click="removeForbidden(idx)"
                  class="text-red-700 hover:text-red-900"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 补充信息 -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
      >
        <div class="p-4 border-b bg-muted/20 flex items-center gap-2">
          <FileText class="h-5 w-5 text-primary" />
          <h3 class="font-semibold text-lg">预算与补充信息</h3>
        </div>
        <div class="p-6 grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <Label>设计预算 (元)</Label>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >¥</span
              >
              <Input
                type="number"
                step="1"
                min="0"
                v-model="budgetYuan"
                class="pl-8"
                placeholder="填写预算金额"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label>期望定稿日期</Label>
            <Input type="date" v-model="formData.deadline" />
          </div>

          <div class="space-y-2 md:col-span-2">
            <Label>特殊要求</Label>
            <textarea
              v-model="formData.specialRequirements"
              class="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="其他任何需要特别说明的需求..."
              maxlength="8000"
            />
          </div>
        </div>
      </div>

      <div
        class="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background/80 backdrop-blur py-4 -mx-6 px-6 z-10"
      >
        <Button type="button" variant="outline" @click="cancel">取消</Button>
        <Button type="submit" :disabled="updateMutation.isPending.value">
          {{ updateMutation.isPending.value ? '保存中...' : '保存 Brief' }}
        </Button>
      </div>
    </form>
  </div>
</template>
