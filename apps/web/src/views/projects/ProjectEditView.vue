<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useProjectQuery,
  useUpdateProjectMutation,
} from '../../api/queries/projects.js';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Input } from '../../components/ui/input/index.js';
import { Label } from '../../components/ui/label/index.js';

const route = useRoute();
const router = useRouter();

const projectId = computed(() => route.params.id as string);

const { data: project, isLoading: isLoadingProject } = useProjectQuery(
  projectId.value,
);
const updateMutation = useUpdateProjectMutation();

const formData = ref({
  name: '',
  exhibitionName: '',
  exhibitionVenue: '',
  boothNumber: '',
  exhibitionDate: '',
  deliveryDeadline: '',
  industry: '',
  notes: '',
  expectedRevision: 0,
});

watch(
  project,
  (newVal) => {
    if (newVal) {
      formData.value = {
        name: newVal.name,
        exhibitionName: newVal.exhibitionName || '',
        exhibitionVenue: newVal.exhibitionVenue || '',
        boothNumber: newVal.boothNumber || '',
        exhibitionDate: newVal.exhibitionDate || '',
        deliveryDeadline: newVal.deliveryDeadline || '',
        industry: newVal.industry || '',
        notes: newVal.notes || '',
        expectedRevision: newVal.revision,
      };
    }
  },
  { immediate: true },
);

async function save() {
  if (!formData.value.name.trim()) {
    return;
  }

  try {
    await updateMutation.mutateAsync({
      id: projectId.value,
      body: {
        name: formData.value.name,
        exhibitionName: formData.value.exhibitionName || undefined,
        exhibitionVenue: formData.value.exhibitionVenue || undefined,
        boothNumber: formData.value.boothNumber || undefined,
        exhibitionDate: formData.value.exhibitionDate || undefined,
        deliveryDeadline: formData.value.deliveryDeadline || undefined,
        industry: formData.value.industry || undefined,
        notes: formData.value.notes || undefined,
        expectedRevision: formData.value.expectedRevision,
      },
    });
    router.push(`/projects/${projectId.value}`);
  } catch (err) {
    console.error('Failed to update project', err);
  }
}

function cancel() {
  router.push(`/projects/${projectId.value}`);
}
</script>

<template>
  <div>
    <PageHeader title="编辑项目" description="修改展台设计项目信息" />

    <div v-if="isLoadingProject" class="flex justify-center p-8">
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
      />
    </div>

    <div
      v-else
      class="max-w-2xl rounded-xl border bg-card text-card-foreground shadow-sm"
    >
      <form class="p-6 space-y-6" @submit.prevent="save">
        <div class="space-y-2">
          <Label for="name"
            >项目名称 <span class="text-destructive">*</span></Label
          >
          <Input
            id="name"
            v-model="formData.name"
            placeholder="请输入项目名称"
            required
          />
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <Label>关联客户</Label>
            <div
              class="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              {{ project?.customerName }}
            </div>
          </div>

          <div class="space-y-2">
            <Label>负责人</Label>
            <div
              class="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              {{ project?.ownerName }}
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-lg pt-4 border-t">展会信息</h3>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2 md:col-span-2">
            <Label for="exhibitionName">展会名称</Label>
            <Input
              id="exhibitionName"
              v-model="formData.exhibitionName"
              placeholder="例如：第xx届中国国际医疗器械博览会"
            />
          </div>
          <div class="space-y-2">
            <Label for="exhibitionVenue">展馆/场馆</Label>
            <Input
              id="exhibitionVenue"
              v-model="formData.exhibitionVenue"
              placeholder="例如：国家会展中心"
            />
          </div>
          <div class="space-y-2">
            <Label for="boothNumber">展位号</Label>
            <Input
              id="boothNumber"
              v-model="formData.boothNumber"
              placeholder="例如：3H-A01"
            />
          </div>
          <div class="space-y-2">
            <Label for="exhibitionDate">展会开始日期</Label>
            <Input
              id="exhibitionDate"
              v-model="formData.exhibitionDate"
              type="date"
            />
          </div>
          <div class="space-y-2">
            <Label for="deliveryDeadline">设计交付截止</Label>
            <Input
              id="deliveryDeadline"
              v-model="formData.deliveryDeadline"
              type="date"
            />
          </div>
          <div class="space-y-2 md:col-span-2">
            <Label for="industry">相关行业</Label>
            <Input
              id="industry"
              v-model="formData.industry"
              placeholder="项目的所属行业"
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="notes">备注信息</Label>
          <textarea
            id="notes"
            v-model="formData.notes"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="其他需要说明的信息..."
          />
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" @click="cancel">取消</Button>
          <Button type="submit" :disabled="updateMutation.isPending.value">
            {{ updateMutation.isPending.value ? '保存中...' : '保存' }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>
