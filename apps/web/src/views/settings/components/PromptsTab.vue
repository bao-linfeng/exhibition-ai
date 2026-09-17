<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  listPromptTemplatesOptions,
  useCreatePromptTemplate,
  useCreatePromptVersion,
  useUpdatePromptVersion,
  usePublishPromptVersion,
  useRollbackPromptVersion,
} from '@/api/queries/prompts.js';
import type {
  PromptTemplateWithVersion,
  PromptVersion,
} from '@/api/queries/prompts.js';

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
import { Textarea } from '@/components/ui/textarea/index.js';
import { useToast } from '@/components/ui/toast/index.js';
import { Loader2, Plus, Edit2, RotateCcw, Send, History } from '@lucide/vue';

const { toast } = useToast();

const { data: templatesResponse, isLoading: isTemplatesLoading } = useQuery(
  listPromptTemplatesOptions(),
);

const templates = computed(() => templatesResponse.value?.templates ?? []);

const selectedTemplateId = ref<string | null>(null);

const { data: templateDetailResponse, isLoading: isTemplateDetailLoading } =
  useQuery({
    queryKey: computed(() => ['prompts', 'template', selectedTemplateId.value]),
    queryFn: async () => {
      if (!selectedTemplateId.value) return null;
      const res = await fetch(
        `/api/v1/settings/prompt-templates/${selectedTemplateId.value}`,
        {
          credentials: 'include',
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        template: PromptTemplateWithVersion;
        versions: PromptVersion[];
      }>;
    },
    enabled: computed(() => !!selectedTemplateId.value),
  });

const templateVersions = computed(
  () => templateDetailResponse.value?.versions ?? [],
);
const currentTemplate = computed(
  () => templateDetailResponse.value?.template ?? null,
);

const createTemplate = useCreatePromptTemplate();
const createVersion = useCreatePromptVersion();
const updateVersion = useUpdatePromptVersion();
const publishVersion = usePublishPromptVersion();
const rollbackVersion = useRollbackPromptVersion();

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

function getStatusColor(status: string) {
  if (status === 'published')
    return 'bg-green-500/15 text-green-700 border-green-500/20';
  if (status === 'draft')
    return 'bg-amber-500/15 text-amber-700 border-amber-500/20';
  return 'bg-slate-500/15 text-slate-700 border-slate-500/20';
}

function getStatusLabel(status: string) {
  if (status === 'published') return '已发布';
  if (status === 'draft') return '草稿';
  return '已归档';
}

const isCreateDialogOpen = ref(false);
const isDraftDialogOpen = ref(false);
const isPublishDialogOpen = ref(false);
const isRollbackDialogOpen = ref(false);

const createForm = ref({
  name: '',
  templateKey: '',
  description: '',
  initialContent: '',
  variables: '',
  changeNote: '',
});

const draftForm = ref({
  content: '',
  variables: '',
  changeNote: '',
});

const publishNote = ref('');
const actingVersion = ref<PromptVersion | null>(null);

function openCreateDialog() {
  createForm.value = {
    name: '',
    templateKey: '',
    description: '',
    initialContent: '',
    variables: '',
    changeNote: '',
  };
  isCreateDialogOpen.value = true;
}

async function handleCreateTemplate() {
  try {
    const vars = createForm.value.variables
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await createTemplate.mutateAsync({
      name: createForm.value.name,
      templateKey: createForm.value.templateKey,
      description: createForm.value.description,
      initialContent: createForm.value.initialContent,
      variables: vars.length > 0 ? vars : undefined,
      changeNote: createForm.value.changeNote || undefined,
    });
    toast({ title: '创建成功' });
    isCreateDialogOpen.value = false;
  } catch (err: unknown) {
    toast({
      title: '创建失败',
      description: err instanceof Error ? err.message : '未知错误',
      variant: 'destructive',
    });
  }
}

function openDraftDialog(mode: 'create' | 'edit', version?: PromptVersion) {
  if (mode === 'edit' && version) {
    actingVersion.value = version;
    draftForm.value = {
      content: version.content,
      variables: version.variables.join(', '),
      changeNote: version.changeNote || '',
    };
  } else {
    actingVersion.value = null;
    draftForm.value = {
      content: currentTemplate.value?.currentVersion?.content || '',
      variables:
        currentTemplate.value?.currentVersion?.variables?.join(', ') || '',
      changeNote: '',
    };
  }
  isDraftDialogOpen.value = true;
}

async function handleSaveDraft() {
  if (!selectedTemplateId.value) return;
  try {
    const vars = draftForm.value.variables
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (actingVersion.value) {
      await updateVersion.mutateAsync({
        id: selectedTemplateId.value,
        versionId: actingVersion.value.id,
        body: {
          content: draftForm.value.content,
          variables: vars.length > 0 ? vars : undefined,
          changeNote: draftForm.value.changeNote || undefined,
        },
      });
      toast({ title: '草稿已更新' });
    } else {
      await createVersion.mutateAsync({
        id: selectedTemplateId.value,
        body: {
          content: draftForm.value.content,
          variables: vars.length > 0 ? vars : undefined,
          changeNote: draftForm.value.changeNote || undefined,
        },
      });
      toast({ title: '草稿已创建' });
    }
    isDraftDialogOpen.value = false;
  } catch (err: unknown) {
    toast({
      title: '保存失败',
      description: err instanceof Error ? err.message : '未知错误',
      variant: 'destructive',
    });
  }
}

function openPublishDialog(version: PromptVersion) {
  actingVersion.value = version;
  publishNote.value = version.changeNote || '';
  isPublishDialogOpen.value = true;
}

async function handlePublish() {
  if (!selectedTemplateId.value || !actingVersion.value) return;
  try {
    await publishVersion.mutateAsync({
      id: selectedTemplateId.value,
      versionId: actingVersion.value.id,
      body: { changeNote: publishNote.value || undefined },
    });
    toast({ title: '版本已发布' });
    isPublishDialogOpen.value = false;
  } catch (err: unknown) {
    toast({
      title: '发布失败',
      description: err instanceof Error ? err.message : '未知错误',
      variant: 'destructive',
    });
  }
}

function openRollbackDialog(version: PromptVersion) {
  actingVersion.value = version;
  isRollbackDialogOpen.value = true;
}

async function handleRollback() {
  if (!selectedTemplateId.value || !actingVersion.value) return;
  try {
    await rollbackVersion.mutateAsync({
      id: selectedTemplateId.value,
      versionId: actingVersion.value.id,
    });
    toast({ title: '回滚成功' });
    isRollbackDialogOpen.value = false;
  } catch (err: unknown) {
    toast({
      title: '回滚失败',
      description: err instanceof Error ? err.message : '未知错误',
      variant: 'destructive',
    });
  }
}

function selectTemplate(template: PromptTemplateWithVersion) {
  selectedTemplateId.value = template.id;
}
</script>

<template>
  <div class="h-full flex space-x-4">
    <!-- Left: List -->
    <div
      class="w-[360px] flex-shrink-0 flex flex-col rounded-md border bg-card shadow-sm overflow-hidden"
    >
      <div class="p-4 border-b flex justify-between items-center bg-muted/20">
        <h3 class="font-semibold">Prompt 模板</h3>
        <Button size="sm" @click="openCreateDialog">
          <Plus class="w-4 h-4 mr-1" />
          新建
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div
          v-if="isTemplatesLoading"
          class="p-8 text-center text-muted-foreground flex items-center justify-center"
        >
          <Loader2 class="h-5 w-5 animate-spin mr-2" /> 加载中...
        </div>
        <div
          v-else-if="templates.length === 0"
          class="p-8 text-center text-muted-foreground"
        >
          暂无模板
        </div>
        <div v-else class="flex flex-col">
          <button
            v-for="tpl in templates"
            :key="tpl.id"
            class="text-left p-4 border-b hover:bg-muted/30 transition-colors"
            :class="{
              'bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary':
                selectedTemplateId === tpl.id,
              'border-l-4 border-l-transparent': selectedTemplateId !== tpl.id,
            }"
            @click="selectTemplate(tpl)"
          >
            <div class="flex justify-between items-start mb-1">
              <span class="font-medium truncate">{{ tpl.name }}</span>
              <Badge
                variant="outline"
                class="text-xs shrink-0"
                :class="
                  tpl.currentVersionId
                    ? 'bg-green-500/15 text-green-700'
                    : 'bg-slate-100 text-slate-500'
                "
              >
                {{
                  tpl.currentVersion
                    ? `v${tpl.currentVersion.version}`
                    : '无版本'
                }}
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground font-mono truncate">
              {{ tpl.templateKey }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Right: Details -->
    <div
      class="flex-1 flex flex-col rounded-md border bg-card shadow-sm overflow-hidden min-w-0"
    >
      <div
        v-if="!selectedTemplateId"
        class="flex-1 flex items-center justify-center text-muted-foreground"
      >
        请在左侧选择或新建一个 Prompt 模板
      </div>
      <div
        v-else-if="isTemplateDetailLoading"
        class="flex-1 flex items-center justify-center text-muted-foreground"
      >
        <Loader2 class="h-6 w-6 animate-spin" />
      </div>
      <div
        v-else-if="currentTemplate"
        class="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 space-y-8"
      >
        <!-- Header -->
        <div>
          <h2 class="text-2xl font-bold tracking-tight mb-2">
            {{ currentTemplate.name }}
          </h2>
          <div
            class="flex items-center space-x-4 text-sm text-muted-foreground"
          >
            <span class="font-mono bg-muted px-1.5 py-0.5 rounded">{{
              currentTemplate.templateKey
            }}</span>
            <span v-if="currentTemplate.description">{{
              currentTemplate.description
            }}</span>
          </div>
        </div>

        <!-- Current Version Preview -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold">
              当前发布版本 ({{
                currentTemplate.currentVersion
                  ? `v${currentTemplate.currentVersion.version}`
                  : '无'
              }})
            </h3>
            <Button
              v-if="currentTemplate.currentVersion"
              variant="outline"
              size="sm"
              @click="openDraftDialog('create')"
            >
              <Plus class="w-4 h-4 mr-1" /> 基于当前创建草稿
            </Button>
            <Button
              v-else
              variant="outline"
              size="sm"
              @click="openDraftDialog('create')"
            >
              <Plus class="w-4 h-4 mr-1" /> 创建第一个草稿
            </Button>
          </div>

          <div
            v-if="currentTemplate.currentVersion"
            class="relative rounded-md border bg-muted/20 p-4"
          >
            <pre
              class="whitespace-pre-wrap font-mono text-sm text-foreground/90 overflow-x-auto"
              >{{ currentTemplate.currentVersion.content }}</pre>
            <div
              class="mt-4 flex flex-wrap gap-2"
              v-if="currentTemplate.currentVersion.variables.length > 0"
            >
              <span class="text-xs text-muted-foreground">变量:</span>
              <Badge
                v-for="v in currentTemplate.currentVersion.variables"
                :key="v"
                variant="secondary"
                class="font-mono"
                >{{ v }}</Badge
              >
            </div>
          </div>
          <div
            v-else
            class="text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center"
          >
            暂无已发布的版本
          </div>
        </div>

        <!-- Version History -->
        <div class="space-y-3 flex-1">
          <h3 class="text-lg font-semibold flex items-center">
            <History class="w-5 h-5 mr-2" />
            版本历史
          </h3>

          <div class="rounded-md border overflow-hidden">
            <Table>
              <TableHeader class="bg-muted/20">
                <TableRow>
                  <TableHead class="w-[80px]">版本</TableHead>
                  <TableHead class="w-[100px]">状态</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead class="w-[160px]">更新时间</TableHead>
                  <TableHead class="text-right w-[200px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="ver in templateVersions"
                  :key="ver.id"
                  :class="{
                    'bg-primary/5': currentTemplate.currentVersionId === ver.id,
                  }"
                >
                  <TableCell class="font-medium">v{{ ver.version }}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      class="border"
                      :class="getStatusColor(ver.status)"
                    >
                      {{ getStatusLabel(ver.status) }}
                    </Badge>
                  </TableCell>
                  <TableCell
                    class="text-sm text-muted-foreground truncate max-w-[200px]"
                    :title="ver.changeNote || ''"
                  >
                    {{ ver.changeNote || '-' }}
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ formatDate(ver.updatedAt) }}
                  </TableCell>
                  <TableCell class="text-right">
                    <div
                      v-if="ver.status === 'draft'"
                      class="flex justify-end space-x-2"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        @click="openDraftDialog('edit', ver)"
                      >
                        <Edit2 class="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        @click="openPublishDialog(ver)"
                      >
                        <Send class="w-4 h-4 mr-1" />
                        发布
                      </Button>
                    </div>
                    <div
                      v-else-if="
                        ver.status === 'published' &&
                        currentTemplate.currentVersionId !== ver.id
                      "
                      class="flex justify-end"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        @click="openRollbackDialog(ver)"
                      >
                        <RotateCcw class="w-4 h-4 mr-1" />
                        回滚至此
                      </Button>
                    </div>
                    <div
                      v-else-if="currentTemplate.currentVersionId === ver.id"
                      class="flex justify-end pr-2 text-primary text-sm font-medium items-center"
                    >
                      当前生效
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow v-if="templateVersions.length === 0">
                  <TableCell
                    colspan="5"
                    class="h-24 text-center text-muted-foreground"
                  >
                    暂无版本记录
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Template Dialog -->
    <Dialog v-model:open="isCreateDialogOpen">
      <DialogContent class="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>新建 Prompt 模板</DialogTitle>
          <DialogDescription>
            创建一个新的模板定义。创建后会自动生成 v1 草稿版本。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label>模板名称</Label>
            <Input v-model="createForm.name" placeholder="如：文章润色" />
          </div>
          <div class="grid gap-2">
            <Label>模板 Key (代码中引用使用)</Label>
            <Input
              v-model="createForm.templateKey"
              placeholder="如：article_polish"
              class="font-mono"
            />
          </div>
          <div class="grid gap-2">
            <Label>描述 (可选)</Label>
            <Input v-model="createForm.description" placeholder="用途说明" />
          </div>
          <div class="grid gap-2">
            <Label>初始 Prompt 内容</Label>
            <Textarea
              v-model="createForm.initialContent"
              :rows="4"
              placeholder="你是一个优秀的助手..."
              class="font-mono text-sm"
            />
          </div>
          <div class="grid gap-2">
            <Label>变量 (英文逗号分隔，可选)</Label>
            <Input
              v-model="createForm.variables"
              placeholder="如：content, style"
              class="font-mono"
            />
          </div>
          <div class="grid gap-2">
            <Label>版本说明 (可选)</Label>
            <Input v-model="createForm.changeNote" placeholder="如：初始版本" />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="isCreateDialogOpen = false"
            :disabled="createTemplate.isPending.value"
            >取消</Button
          >
          <Button
            @click="handleCreateTemplate"
            :disabled="
              createTemplate.isPending.value ||
              !createForm.name ||
              !createForm.templateKey ||
              !createForm.initialContent
            "
          >
            <Loader2
              v-if="createTemplate.isPending.value"
              class="mr-2 h-4 w-4 animate-spin"
            />
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Draft Dialog -->
    <Dialog v-model:open="isDraftDialogOpen">
      <DialogContent class="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{{
            actingVersion ? '编辑草稿' : '新建草稿'
          }}</DialogTitle>
          <DialogDescription>
            保存草稿不会影响当前线上服务，草稿发布后才会生效。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label>Prompt 内容</Label>
            <Textarea
              v-model="draftForm.content"
              :rows="10"
              class="font-mono text-sm leading-relaxed"
            />
          </div>
          <div class="grid gap-2">
            <Label>变量 (英文逗号分隔，可选)</Label>
            <Input
              v-model="draftForm.variables"
              placeholder="如：input_text, tone"
              class="font-mono"
            />
          </div>
          <div class="grid gap-2">
            <Label>变更说明 (可选)</Label>
            <Input
              v-model="draftForm.changeNote"
              placeholder="记录修改了什么..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="isDraftDialogOpen = false"
            :disabled="
              createVersion.isPending.value || updateVersion.isPending.value
            "
            >取消</Button
          >
          <Button
            @click="handleSaveDraft"
            :disabled="
              createVersion.isPending.value ||
              updateVersion.isPending.value ||
              !draftForm.content
            "
          >
            <Loader2
              v-if="
                createVersion.isPending.value || updateVersion.isPending.value
              "
              class="mr-2 h-4 w-4 animate-spin"
            />
            保存草稿
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Publish Dialog -->
    <Dialog v-model:open="isPublishDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发布版本 v{{ actingVersion?.version }}</DialogTitle>
          <DialogDescription>
            发布后，此版本将作为线上默认使用的 Prompt 版本。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label>发布说明 (可选)</Label>
            <Input v-model="publishNote" placeholder="记录发布原因..." />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="isPublishDialogOpen = false"
            :disabled="publishVersion.isPending.value"
            >取消</Button
          >
          <Button
            @click="handlePublish"
            :disabled="publishVersion.isPending.value"
          >
            <Loader2
              v-if="publishVersion.isPending.value"
              class="mr-2 h-4 w-4 animate-spin"
            />
            确认发布
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Rollback Dialog -->
    <Dialog v-model:open="isRollbackDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>回滚至版本 v{{ actingVersion?.version }}</DialogTitle>
          <DialogDescription>
            确认要将当前生效版本回滚到 v{{ actingVersion?.version }}
            吗？此操作会立即生效。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            @click="isRollbackDialogOpen = false"
            :disabled="rollbackVersion.isPending.value"
            >取消</Button
          >
          <Button
            variant="destructive"
            @click="handleRollback"
            :disabled="rollbackVersion.isPending.value"
          >
            <Loader2
              v-if="rollbackVersion.isPending.value"
              class="mr-2 h-4 w-4 animate-spin"
            />
            确认回滚
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
