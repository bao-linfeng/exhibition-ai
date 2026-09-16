<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useBriefQuery,
  useConfirmBriefMutation,
  useParseBriefMutation,
} from '../../api/queries/briefs.js';
import { useProjectQuery } from '../../api/queries/projects.js';
import { useUserStore } from '../../stores/user.js';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Badge } from '../../components/ui/badge/index.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog/index.js';
import {
  ChevronRight,
  FileText,
  Maximize,
  PenTool,
  Palette,
  CheckCircle,
  LayoutTemplate,
  Banknote,
  Calendar,
  AlertCircle,
  History,
  Check,
  Wand2,
} from '@lucide/vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const projectId = computed(() => route.params.id as string);

const { data: project, isLoading: isLoadingProject } = useProjectQuery(
  projectId.value,
);
const { data: brief, isLoading: isLoadingBrief } = useBriefQuery(
  projectId.value,
);
const confirmMutation = useConfirmBriefMutation();
const parseMutation = useParseBriefMutation();

const showConfirmDialog = ref(false);
const showParseDialog = ref(false);
const parseText = ref('');

const canEdit = computed(() => {
  const role = userStore.user?.role;
  return role === 'admin' || role === 'sales' || role === 'designer';
});

const isConfirmed = computed(() => !!brief.value?.confirmedAt);

const openSideMap: Record<string, string> = {
  front: '正面',
  right: '右侧',
  back: '背面',
  left: '左侧',
};

const areaTypeMap: Record<string, string> = {
  reception: '前台接待',
  meeting: '洽谈区',
  display: '展示区',
  storage: '储物区',
  led: 'LED屏',
  demo: '演示区',
};

function formatCurrency(minor: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(minor / 100);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function goBack() {
  router.push(`/projects/${projectId.value}`);
}

function editBrief() {
  router.push(`/projects/${projectId.value}/brief/edit`);
}

function viewHistory() {
  router.push(`/projects/${projectId.value}/brief/history`);
}

async function confirmBrief() {
  if (!brief.value) return;
  try {
    await confirmMutation.mutateAsync({
      projectId: projectId.value,
      body: {
        briefRevisionId: brief.value.id,
        expectedRevision: project.value?.revision || 0,
      },
    });
    showConfirmDialog.value = false;
  } catch (e) {
    if ((e as Error).message === 'conflict') {
      alert('项目状态已被修改，请刷新后重试');
    } else {
      alert('确认失败，请稍后重试');
    }
  }
}

async function startParse() {
  if (!parseText.value.trim()) return;
  try {
    await parseMutation.mutateAsync({
      projectId: projectId.value,
      body: {
        text: parseText.value,
        baseBriefRevisionId: brief.value?.id,
      },
    });
    showParseDialog.value = false;
    parseText.value = '';
    alert('AI 解析任务已提交，请稍后在任务中心查看结果');
  } catch {
    alert('解析请求失败，请重试');
  }
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
      <button class="hover:text-foreground transition-colors" @click="goBack">
        {{ project.name }}
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <span class="text-foreground font-medium">Brief</span>
    </div>

    <PageHeader title="设计 Brief">
      <template #actions>
        <Button
          v-if="canEdit"
          variant="outline"
          class="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
          @click="showParseDialog = true"
        >
          <Wand2 class="mr-2 h-4 w-4" />
          AI 解析
        </Button>
        <Button variant="outline" @click="viewHistory">
          <History class="mr-2 h-4 w-4" />
          历史版本
        </Button>
        <Button
          v-if="canEdit && !isConfirmed && brief"
          variant="default"
          class="bg-green-600 hover:bg-green-700 text-white"
          @click="showConfirmDialog = true"
        >
          <Check class="mr-2 h-4 w-4" />
          确认 Brief
        </Button>
        <Button
          v-if="canEdit && !isConfirmed && brief"
          variant="outline"
          @click="editBrief"
        >
          <PenTool class="mr-2 h-4 w-4" />
          编辑 Brief
        </Button>
      </template>
    </PageHeader>

    <div
      v-if="!brief"
      class="flex flex-col items-center justify-center p-12 rounded-xl border border-dashed bg-muted/30"
    >
      <div
        class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
      >
        <FileText class="h-8 w-8 text-primary" />
      </div>
      <h3 class="text-lg font-medium mb-2">暂无 Brief</h3>
      <p class="text-muted-foreground mb-6 text-center max-w-md">
        当前项目还没有设计 Brief。创建 Brief
        以明确展台需求、预算和设计偏好，指导后续设计工作。
      </p>
      <Button v-if="canEdit" @click="editBrief">创建 Brief</Button>
    </div>

    <div v-else class="space-y-6">
      <div class="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border">
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              当前版本
              <Badge variant="secondary">v{{ brief.number }}</Badge>
              <Badge
                v-if="isConfirmed"
                class="bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
              >
                <CheckCircle class="w-3 h-3 mr-1" /> 已确认
              </Badge>
              <Badge v-else variant="outline" class="text-muted-foreground">
                未确认
              </Badge>
            </h2>
          </div>
          <p class="text-sm text-muted-foreground mt-1">
            更新时间：{{ formatDate(brief.createdAt) }}
            <span v-if="isConfirmed" class="ml-4">
              确认时间：{{ formatDate(brief.confirmedAt!) }}
            </span>
          </p>
        </div>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <!-- 展台信息 -->
        <div
          class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
        >
          <div class="p-4 border-b bg-muted/20 flex items-center gap-2">
            <Maximize class="h-5 w-5 text-primary" />
            <h3 class="font-semibold text-lg">展台规格</h3>
          </div>
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm font-medium text-muted-foreground mb-1">
                  尺寸 (宽×深)
                </p>
                <p class="text-base font-medium">
                  {{ brief.content.booth.widthM }}m ×
                  {{ brief.content.booth.depthM }}m
                </p>
              </div>
              <div>
                <p class="text-sm font-medium text-muted-foreground mb-1">
                  面积
                </p>
                <p class="text-base font-medium text-primary">
                  {{
                    (
                      brief.content.booth.widthM * brief.content.booth.depthM
                    ).toFixed(2)
                  }}
                  m²
                </p>
              </div>
              <div>
                <p class="text-sm font-medium text-muted-foreground mb-1">
                  限高
                </p>
                <p class="text-base font-medium">
                  {{ brief.content.booth.heightLimitM }}m
                </p>
              </div>
              <div>
                <p class="text-sm font-medium text-muted-foreground mb-1">
                  开放面 ({{ brief.content.booth.openSides.length }})
                </p>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="side in brief.content.booth.openSides"
                    :key="side"
                    variant="secondary"
                  >
                    {{ openSideMap[side] }}
                  </Badge>
                </div>
              </div>
            </div>
            <div
              v-if="brief.content.booth.hallRestrictions"
              class="pt-4 border-t"
            >
              <p
                class="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1"
              >
                <AlertCircle class="w-4 h-4" /> 展馆特殊限制
              </p>
              <p class="text-sm">{{ brief.content.booth.hallRestrictions }}</p>
            </div>
          </div>
        </div>

        <!-- 品牌信息 -->
        <div
          class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
        >
          <div class="p-4 border-b bg-muted/20 flex items-center gap-2">
            <Palette class="h-5 w-5 text-primary" />
            <h3 class="font-semibold text-lg">品牌与视觉</h3>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground mb-1">
                参展品牌名称
              </p>
              <p class="text-base font-medium">
                {{ brief.content.brand.name }}
              </p>
            </div>

            <div class="flex gap-6 pt-2">
              <div v-if="brief.content.brand.primaryColor">
                <p class="text-sm font-medium text-muted-foreground mb-2">
                  主品牌色
                </p>
                <div class="flex items-center gap-2">
                  <div
                    class="w-8 h-8 rounded-md border shadow-sm"
                    :style="{
                      backgroundColor: brief.content.brand.primaryColor,
                    }"
                  />
                  <span class="text-sm uppercase">{{
                    brief.content.brand.primaryColor
                  }}</span>
                </div>
              </div>
              <div v-if="brief.content.brand.secondaryColor">
                <p class="text-sm font-medium text-muted-foreground mb-2">
                  辅助色
                </p>
                <div class="flex items-center gap-2">
                  <div
                    class="w-8 h-8 rounded-md border shadow-sm"
                    :style="{
                      backgroundColor: brief.content.brand.secondaryColor,
                    }"
                  />
                  <span class="text-sm uppercase">{{
                    brief.content.brand.secondaryColor
                  }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="
                brief.content.brand.visualKeywords &&
                brief.content.brand.visualKeywords.length > 0
              "
              class="pt-4 border-t"
            >
              <p class="text-sm font-medium text-muted-foreground mb-2">
                视觉关键词
              </p>
              <div class="flex flex-wrap gap-2">
                <Badge
                  v-for="kw in brief.content.brand.visualKeywords"
                  :key="kw"
                  variant="outline"
                >
                  {{ kw }}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 功能与风格 -->
      <div class="grid gap-6 md:grid-cols-3">
        <div
          class="md:col-span-2 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
        >
          <div class="p-4 border-b bg-muted/20 flex items-center gap-2">
            <LayoutTemplate class="h-5 w-5 text-primary" />
            <h3 class="font-semibold text-lg">功能区划需求</h3>
          </div>
          <div class="p-0">
            <div class="divide-y">
              <div
                v-for="(area, index) in brief.content.functionalAreas"
                :key="index"
                class="p-4 flex flex-col sm:flex-row gap-4 sm:items-center hover:bg-muted/10 transition-colors"
              >
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-base">{{
                      areaTypeMap[area.type]
                    }}</span>
                    <Badge
                      v-if="area.required"
                      class="bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
                    >
                      必选
                    </Badge>
                    <Badge v-else variant="secondary">可选</Badge>
                  </div>
                  <p
                    v-if="area.description"
                    class="text-sm text-muted-foreground"
                  >
                    {{ area.description }}
                  </p>
                </div>
                <div
                  v-if="area.quantity"
                  class="text-sm bg-muted px-3 py-1.5 rounded-md font-medium whitespace-nowrap"
                >
                  数量: {{ area.quantity }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="md:col-span-1 space-y-6">
          <div
            class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
          >
            <div class="p-4 border-b bg-muted/20">
              <h3 class="font-semibold text-lg">风格偏好</h3>
            </div>
            <div class="p-4 space-y-4">
              <div>
                <p class="text-sm font-medium text-muted-foreground mb-2">
                  设计风格
                </p>
                <div class="flex flex-wrap gap-2">
                  <Badge v-for="kw in brief.content.style.keywords" :key="kw">
                    {{ kw }}
                  </Badge>
                </div>
              </div>
              <div
                v-if="
                  brief.content.style.materials &&
                  brief.content.style.materials.length > 0
                "
              >
                <p class="text-sm font-medium text-muted-foreground mb-2">
                  材质偏好
                </p>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="m in brief.content.style.materials"
                    :key="m"
                    variant="outline"
                  >
                    {{ m }}
                  </Badge>
                </div>
              </div>
              <div
                v-if="
                  brief.content.style.forbiddenElements &&
                  brief.content.style.forbiddenElements.length > 0
                "
              >
                <p class="text-sm font-medium text-muted-foreground mb-2">
                  禁用元素/材质
                </p>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="f in brief.content.style.forbiddenElements"
                    :key="f"
                    variant="destructive"
                  >
                    {{ f }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
          >
            <div class="p-4 border-b bg-muted/20">
              <h3 class="font-semibold text-lg">业务要求</h3>
            </div>
            <div class="p-4 space-y-4">
              <div v-if="brief.content.budget" class="flex items-center gap-3">
                <div
                  class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Banknote class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">预算</p>
                  <p class="font-medium">
                    {{ formatCurrency(brief.content.budget.amountMinor) }}
                  </p>
                </div>
              </div>
              <div
                v-if="brief.content.deadline"
                class="flex items-center gap-3"
              >
                <div
                  class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Calendar class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">期望定稿日期</p>
                  <p class="font-medium">
                    {{ formatDate(brief.content.deadline) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="brief.content.specialRequirements"
        class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
      >
        <div class="p-4 border-b bg-muted/20">
          <h3 class="font-semibold text-lg">特殊要求与补充说明</h3>
        </div>
        <div class="p-6">
          <p class="text-sm whitespace-pre-wrap leading-relaxed">
            {{ brief.content.specialRequirements }}
          </p>
        </div>
      </div>
    </div>

    <Dialog :open="showConfirmDialog" @update:open="showConfirmDialog = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>确认当前 Brief</DialogTitle>
          <DialogDescription>
            确认后，Brief
            将作为设计的正式依据。如果需要修改，将会生成新的版本，当前确认状态将重置。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showConfirmDialog = false">
            取消
          </Button>
          <Button
            :disabled="confirmMutation.isPending.value"
            class="bg-green-600 hover:bg-green-700 text-white"
            @click="confirmBrief"
          >
            {{ confirmMutation.isPending.value ? '确认中...' : '确认无误' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="showParseDialog" @update:open="showParseDialog = $event">
      <DialogContent class="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>AI 解析 Brief</DialogTitle>
          <DialogDescription>
            输入客户的自然语言描述，AI 将提取结构化的 Brief 候选内容
          </DialogDescription>
        </DialogHeader>
        <div class="py-4">
          <textarea
            v-model="parseText"
            class="w-full h-48 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="请输入客户描述，例如：我们是一家做汽车零部件的企业，参加上海车展，展台面积约36平米，预算80万，希望设计现代科技感的展台..."
            maxlength="50000"
          />
          <p class="text-xs text-muted-foreground mt-2">
            解析结果不会直接覆盖当前 Brief，请在任务完成后查看并采纳
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showParseDialog = false">
            取消
          </Button>
          <Button
            :disabled="parseMutation.isPending.value || !parseText.trim()"
            @click="startParse"
          >
            <Wand2 v-if="!parseMutation.isPending.value" class="mr-2 h-4 w-4" />
            {{ parseMutation.isPending.value ? '解析中...' : '开始解析' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
