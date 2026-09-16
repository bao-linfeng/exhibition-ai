<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useAssetsQuery,
  useCreateUploadSessionMutation,
  useCompleteUploadMutation,
  useHideAssetMutation,
  useCreateDownloadUrlMutation,
  assetKeys,
} from '../../api/queries/assets.js';
import { useProjectQuery } from '../../api/queries/projects.js';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Badge } from '../../components/ui/badge/index.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog/index.js';
import {
  ChevronRight,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  RefreshCw,
  FileImage,
  Image as ImageIcon,
} from 'lucide-vue-next';
import AssetThumbnail from './AssetThumbnail.vue';

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id as string);
const queryClient = useQueryClient();

const filterKind = ref<string>('');
const filterStatus = ref<string>('');
const cursor = ref<string | undefined>(undefined);

// Queries
const { data: project } = useProjectQuery(projectId.value);
const {
  data: assetsData,
  isLoading,
  isError,
} = useAssetsQuery(
  projectId.value,
  computed(() => ({
    kind: filterKind.value || undefined,
    status: filterStatus.value || undefined,
    cursor: cursor.value,
  })),
);

// Mutations
const createSessionMutation = useCreateUploadSessionMutation();
const completeUploadMutation = useCompleteUploadMutation();
const hideAssetMutation = useHideAssetMutation();
const downloadUrlMutation = useCreateDownloadUrlMutation();

const assets = computed(() => assetsData.value?.data || []);
const nextCursor = computed(() => assetsData.value?.page?.nextCursor);

// Filter lists
const kindOptions = [
  { label: '全部', value: '' },
  { label: 'Logo', value: 'logo' },
  { label: '产品图', value: 'product' },
  { label: '参考图', value: 'reference' },
  { label: '品牌资料', value: 'brand_material' },
];

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待验证', value: 'pending' },
  { label: '验证中', value: 'validating' },
  { label: '就绪', value: 'ready' },
  { label: '失败', value: 'rejected' },
];

// --- Upload Logic ---
const fileInput = ref<HTMLInputElement | null>(null);

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'validating' | 'ready' | 'rejected';
  error?: string;
}

const uploadQueue = ref<UploadItem[]>([]);
const isUploading = computed(() =>
  uploadQueue.value.some((item) =>
    ['pending', 'uploading', 'validating'].includes(item.status),
  ),
);

function triggerUpload() {
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const files = Array.from(target.files);
  if (files.length > 10) {
    alert('最多批量上传 10 个文件');
    target.value = '';
    return;
  }

  const validMimes = ['image/png', 'image/jpeg', 'image/webp'];
  const maxSize = 25 * 1024 * 1024; // 25MiB

  const newItems: UploadItem[] = [];
  for (const file of files) {
    if (!validMimes.includes(file.type)) {
      alert(`仅支持 PNG/JPEG/WebP: ${file.name}`);
      continue;
    }
    if (file.size > maxSize) {
      alert(`文件超过 25MiB 限制: ${file.name}`);
      continue;
    }
    newItems.push({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
    });
  }

  target.value = ''; // reset

  if (newItems.length > 0) {
    uploadQueue.value.push(...newItems);
    processQueue(newItems);
  }
}

async function processUpload(item: UploadItem) {
  try {
    item.status = 'uploading';
    const session = await createSessionMutation.mutateAsync({
      projectId: projectId.value,
      body: {
        originalFilename: item.file.name,
        mimeType: item.file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        sizeBytes: item.file.size,
        kind: (filterKind.value || 'reference') as
          'logo' | 'product' | 'reference' | 'brand_material',
      },
    });

    await fetch(session.url, {
      method: 'PUT',
      headers: session.requiredHeaders as Record<string, string>,
      body: item.file,
    });

    item.status = 'validating';
    await completeUploadMutation.mutateAsync({
      projectId: projectId.value,
      uploadId: session.uploadId,
      body: {},
    });

    item.status = 'ready';
  } catch (error) {
    item.status = 'rejected';
    item.error = (error as Error).message || '上传失败';
  }
}

async function processQueue(items: UploadItem[], concurrency = 3) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      if (item) {
        await processUpload(item);
      }
    }
  }

  const workers = Array.from({
    length: Math.min(concurrency, items.length),
  }).map(() => worker());
  await Promise.all(workers);
  queryClient.invalidateQueries({ queryKey: assetKeys.all(projectId.value) });
}

function clearFinishedQueue() {
  uploadQueue.value = uploadQueue.value.filter(
    (item) =>
      item.status === 'pending' ||
      item.status === 'uploading' ||
      item.status === 'validating',
  );
}

// --- Asset Actions ---
interface Asset {
  id: string;
  originalFilename: string;
  status: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

const assetToHide = ref<Asset | null>(null);
const showHideDialog = ref(false);

function confirmHide(asset: Asset) {
  assetToHide.value = asset;
  showHideDialog.value = true;
}

async function handleHide() {
  if (!assetToHide.value) return;
  try {
    await hideAssetMutation.mutateAsync({
      projectId: projectId.value,
      assetId: assetToHide.value.id,
    });
    showHideDialog.value = false;
    assetToHide.value = null;
  } catch {
    alert('隐藏素材失败');
  }
}

async function downloadOriginal(asset: Asset) {
  try {
    const data = await downloadUrlMutation.mutateAsync({
      projectId: projectId.value,
      assetId: asset.id,
      body: { variant: 'original' },
    });
    window.open(data.url, '_blank');
  } catch {
    alert('获取下载链接失败');
  }
}

async function previewOriginal(asset: Asset) {
  if (asset.status !== 'ready') return;
  try {
    const data = await downloadUrlMutation.mutateAsync({
      projectId: projectId.value,
      assetId: asset.id,
      body: { variant: 'original' },
    });
    window.open(data.url, '_blank');
  } catch {
    alert('获取预览链接失败');
  }
}

function formatSize(bytes: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatStatus(status: string) {
  switch (status) {
    case 'pending':
      return '待验证';
    case 'validating':
      return '验证中';
    case 'ready':
      return '就绪';
    case 'rejected':
      return '失败';
    default:
      return status;
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'validating':
      return 'default'; // Or some blue variant if available
    case 'ready':
      return 'outline'; // typically outline or constructive
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center text-sm text-muted-foreground">
      <button
        class="hover:text-foreground transition-colors"
        @click="router.push('/projects')"
      >
        项目管理
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <button
        v-if="project"
        class="hover:text-foreground transition-colors"
        @click="router.push(`/projects/${projectId}`)"
      >
        {{ project.name }}
      </button>
      <span v-else>...</span>
      <ChevronRight class="mx-2 h-4 w-4" />
      <span class="text-foreground font-medium">素材管理</span>
    </div>

    <PageHeader title="素材管理">
      <template #actions>
        <Button variant="default" @click="triggerUpload">
          <Upload class="mr-2 h-4 w-4" />
          批量上传
        </Button>
      </template>
    </PageHeader>

    <input
      ref="fileInput"
      type="file"
      multiple
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Upload Queue -->
    <div
      v-if="uploadQueue.length > 0"
      class="mb-6 p-4 border rounded-lg bg-card shadow-sm space-y-3"
    >
      <div class="flex justify-between items-center pb-2 border-b">
        <h3 class="font-medium text-sm flex items-center">
          <Upload class="mr-2 h-4 w-4" />
          上传队列 ({{ uploadQueue.length }})
        </h3>
        <Button
          v-if="!isUploading"
          variant="ghost"
          size="sm"
          @click="clearFinishedQueue"
        >
          清除已完成
        </Button>
      </div>
      <div class="space-y-2 max-h-48 overflow-y-auto pr-2">
        <div
          v-for="item in uploadQueue"
          :key="item.id"
          class="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-md"
        >
          <div class="flex items-center gap-2 truncate">
            <FileImage class="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span class="truncate max-w-[200px]" :title="item.file.name">{{
              item.file.name
            }}</span>
            <span class="text-xs text-muted-foreground"
              >({{ formatSize(item.file.size) }})</span
            >
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span v-if="item.status === 'pending'" class="text-muted-foreground"
              >待上传</span
            >
            <span
              v-else-if="item.status === 'uploading'"
              class="text-blue-500 flex items-center"
            >
              <RefreshCw class="h-3 w-3 animate-spin mr-1" />上传中
            </span>
            <span
              v-else-if="item.status === 'validating'"
              class="text-amber-500 flex items-center"
            >
              <RefreshCw class="h-3 w-3 animate-spin mr-1" />校验中
            </span>
            <span
              v-else-if="item.status === 'ready'"
              class="text-green-500 font-medium"
              >完成</span
            >
            <span
              v-else-if="item.status === 'rejected'"
              class="text-destructive font-medium"
              :title="item.error"
              >失败</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div
      class="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted/20 rounded-lg border"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">分类:</span>
        <div class="flex gap-1 flex-wrap">
          <Button
            v-for="opt in kindOptions"
            :key="opt.value"
            :variant="filterKind === opt.value ? 'default' : 'outline'"
            size="sm"
            @click="
              filterKind = opt.value;
              cursor = undefined;
            "
          >
            {{ opt.label }}
          </Button>
        </div>
      </div>
      <div class="w-px h-6 bg-border mx-2 hidden sm:block" />
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">状态:</span>
        <div class="flex gap-1 flex-wrap">
          <Button
            v-for="opt in statusOptions"
            :key="opt.value"
            :variant="filterStatus === opt.value ? 'default' : 'outline'"
            size="sm"
            @click="
              filterStatus = opt.value;
              cursor = undefined;
            "
          >
            {{ opt.label }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div v-if="isLoading" class="flex justify-center p-12">
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
      />
    </div>

    <div
      v-else-if="isError"
      class="flex flex-col items-center justify-center p-12 text-destructive"
    >
      <AlertCircle class="h-12 w-12 mb-4 opacity-80" />
      <p class="text-lg font-medium">无法加载素材</p>
      <p class="text-sm opacity-80 mt-1">请刷新页面重试</p>
    </div>

    <div
      v-else-if="assets.length === 0"
      class="flex flex-col items-center justify-center p-16 border-2 border-dashed rounded-xl bg-card"
    >
      <div
        class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
      >
        <ImageIcon class="h-8 w-8 text-primary" />
      </div>
      <h3 class="text-xl font-bold mb-2">暂无素材</h3>
      <p class="text-muted-foreground mb-6 text-center max-w-md">
        本项目目前还没有上传任何素材，点击下方按钮或右上角批量上传。
      </p>
      <Button @click="triggerUpload">
        <Upload class="mr-2 h-4 w-4" />
        上传素材
      </Button>
    </div>

    <div v-else class="space-y-6">
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        <div
          v-for="asset in assets"
          :key="asset.id"
          class="group rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
        >
          <div
            class="p-3 border-b bg-muted/10 flex justify-between items-center gap-2"
          >
            <h4
              class="font-medium text-sm truncate flex-1"
              :title="asset.originalFilename"
            >
              {{ asset.originalFilename }}
            </h4>
            <Badge :variant="getStatusBadgeVariant(asset.status)">
              <RefreshCw
                v-if="asset.status === 'validating'"
                class="mr-1 h-3 w-3 animate-spin inline-block"
              />
              {{ formatStatus(asset.status) }}
            </Badge>
          </div>

          <div class="p-4 flex-1 flex flex-col">
            <AssetThumbnail
              :project-id="projectId"
              :asset-id="asset.id"
              :status="asset.status"
              class="mb-4"
              @click="previewOriginal(asset)"
            />

            <div class="mt-auto space-y-3">
              <div class="flex justify-between text-xs text-muted-foreground">
                <span v-if="asset.status === 'ready' && asset.width">
                  {{ asset.width }} × {{ asset.height }}
                </span>
                <span v-else>尺寸未知</span>
                <span>{{ formatSize(asset.sizeBytes) }}</span>
              </div>

              <div class="flex gap-2 pt-2 border-t">
                <Button
                  v-if="asset.status === 'ready'"
                  variant="outline"
                  size="sm"
                  class="flex-1"
                  @click="downloadOriginal(asset)"
                >
                  <Download class="mr-1.5 h-3.5 w-3.5" />
                  下载原图
                </Button>
                <Button
                  v-if="asset.status === 'rejected'"
                  variant="outline"
                  size="sm"
                  class="flex-1"
                  @click="triggerUpload"
                >
                  <Upload class="mr-1.5 h-3.5 w-3.5" />
                  重新上传
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  title="删除"
                  @click="confirmHide(asset)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="nextCursor" class="flex justify-center pt-4">
        <Button variant="outline" @click="cursor = nextCursor">加载更多</Button>
      </div>
    </div>

    <!-- Hide Dialog -->
    <Dialog :open="showHideDialog" @update:open="showHideDialog = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          <p class="text-sm text-muted-foreground">
            确定要删除素材 "{{ assetToHide?.originalFilename }}"
            吗？此操作不可恢复。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showHideDialog = false">
            取消
          </Button>
          <Button
            variant="destructive"
            :disabled="hideAssetMutation.isPending.value"
            @click="handleHide"
          >
            {{ hideAssetMutation.isPending.value ? '删除中...' : '确认删除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
