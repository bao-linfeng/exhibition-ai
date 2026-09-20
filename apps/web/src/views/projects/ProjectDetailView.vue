<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useProjectQuery,
  useProjectMembersQuery,
  useRemoveProjectMemberMutation,
  useAddProjectMemberMutation,
  useUserOptionsQuery,
  useTransferOwnerMutation,
  useTransitionProjectMutation,
} from '../../api/queries/projects.js';
import { useUserStore } from '../../stores/user.js';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import {
  FolderKanban,
  Calendar,
  MapPin,
  User,
  Users,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  RotateCcw,
  Send,
  Archive,
  ArchiveRestore,
} from '@lucide/vue';
import { Button } from '../../components/ui/button/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table/index.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog/index.js';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const projectId = computed(() => route.params.id as string);

const { data: project, isLoading } = useProjectQuery(projectId.value);
const { data: membersData, isLoading: isLoadingMembers } =
  useProjectMembersQuery(projectId.value);

const removeMemberMutation = useRemoveProjectMemberMutation();
const addMemberMutation = useAddProjectMemberMutation();
const transferOwnerMutation = useTransferOwnerMutation();
const { data: usersData } = useUserOptionsQuery();

const showAddMemberDialog = ref(false);
const showTransferOwnerDialog = ref(false);
const selectedUserId = ref('');
const transferUserId = ref('');
const showSubmitReviewDialog = ref(false);
const showRejectDialog = ref(false);
const rejectComment = ref('');

const transitionMutation = useTransitionProjectMutation();

const canSubmitReview = computed(() => {
  if (!project.value) return false;
  if (!['admin', 'sales'].includes(userStore.user?.role ?? '')) return false;
  return (
    project.value.status === 'designing' && !!project.value.selectedVersionId
  );
});

const canApprove = computed(() => {
  if (!project.value) return false;
  if (!['admin', 'sales'].includes(userStore.user?.role ?? '')) return false;
  return project.value.status === 'reviewing';
});

const canRequestChanges = computed(() => {
  if (!project.value) return false;
  if (!['admin', 'sales'].includes(userStore.user?.role ?? '')) return false;
  return project.value.status === 'reviewing';
});

const canReopen = computed(() => {
  if (!project.value) return false;
  if (userStore.user?.role !== 'admin') return false;
  return project.value.status === 'approved';
});

const canArchive = computed(() => {
  if (!project.value) return false;
  if (userStore.user?.role !== 'admin') return false;
  return !['archived', 'reviewing'].includes(project.value.status);
});

const isArchived = computed(() => project.value?.status === 'archived');

const canEnterDesignWorkspace = computed(() => {
  if (!project.value) return false;
  return ['designing', 'reviewing', 'approved'].includes(project.value.status);
});

const canRestore = computed(() => {
  if (!project.value) return false;
  if (userStore.user?.role !== 'admin') return false;
  return project.value.status === 'archived';
});

async function submitReview() {
  if (!project.value) return;
  await transitionMutation.mutateAsync({
    projectId: projectId.value,
    action: 'submit_review',
    expectedRevision: project.value.revision,
  });
  showSubmitReviewDialog.value = false;
}

async function approveProject() {
  if (!project.value || !confirm('确定批准该项目？批准后将锁定当前选图版本。'))
    return;
  await transitionMutation.mutateAsync({
    projectId: projectId.value,
    action: 'approve',
    expectedRevision: project.value.revision,
  });
}

async function requestChanges() {
  if (!project.value || !rejectComment.value.trim()) return;
  await transitionMutation.mutateAsync({
    projectId: projectId.value,
    action: 'request_changes',
    comment: rejectComment.value,
    expectedRevision: project.value.revision,
  });
  showRejectDialog.value = false;
  rejectComment.value = '';
}

async function reopenProject() {
  if (!project.value || !confirm('确定重新打开该项目？')) return;
  await transitionMutation.mutateAsync({
    projectId: projectId.value,
    action: 'reopen',
    expectedRevision: project.value.revision,
  });
}

async function archiveProject() {
  if (!project.value || !confirm('确定归档该项目？归档后项目将变为只读。'))
    return;
  await transitionMutation.mutateAsync({
    projectId: projectId.value,
    action: 'archive',
    expectedRevision: project.value.revision,
  });
}

async function restoreProject() {
  if (!project.value || !confirm('确定恢复该项目？')) return;
  await transitionMutation.mutateAsync({
    projectId: projectId.value,
    action: 'restore',
    expectedRevision: project.value.revision,
  });
}

const isMember = computed(() =>
  membersData.value?.some(
    (m: { userId: string }) => m.userId === userStore.user?.id,
  ),
);
const isOwner = computed(() => project.value?.ownerId === userStore.user?.id);

const canEditProject = computed(() => {
  if (userStore.user?.role === 'admin') return true;
  if (userStore.user?.role === 'designer' && isMember.value) return true;
  if (userStore.user?.role === 'sales' && isOwner.value) return true;
  return false;
});

const canTransferOwner = computed(() => userStore.user?.role === 'admin');
const canManageMembers = computed(
  () => userStore.user?.role === 'admin' || isOwner.value,
);

function goBack() {
  router.push('/projects');
}

function viewCustomer() {
  if (project.value?.customerId) {
    router.push(`/customers/${project.value.customerId}`);
  }
}

function editProject() {
  router.push(`/projects/${projectId.value}/edit`);
}

async function removeMember(userId: string) {
  if (confirm('确定要移除该成员吗？')) {
    await removeMemberMutation.mutateAsync({
      projectId: projectId.value,
      userId,
      expectedRevision: project.value?.revision || 0,
    });
  }
}

async function addMember() {
  if (!selectedUserId.value) return;
  await addMemberMutation.mutateAsync({
    projectId: projectId.value,
    userId: selectedUserId.value,
  });
  showAddMemberDialog.value = false;
  selectedUserId.value = '';
}

async function transferOwner(userId?: string) {
  const targetId = userId || transferUserId.value;
  if (!targetId) return;
  await transferOwnerMutation.mutateAsync({
    projectId: projectId.value,
    userId: targetId,
    expectedRevision: project.value?.revision || 0,
  });
  showTransferOwnerDialog.value = false;
  transferUserId.value = '';
}

const availableUsers = computed(() => {
  if (!usersData.value?.data || !membersData.value) return [];
  const memberIds = membersData.value.map((m: { userId: string }) => m.userId);
  return usersData.value.data.filter(
    (u: { id: string }) => !memberIds.includes(u.id),
  );
});
</script>

<template>
  <div v-if="isLoading" class="flex justify-center p-12">
    <div
      class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
    />
  </div>

  <div v-else-if="project">
    <div class="mb-4 flex items-center text-sm text-muted-foreground">
      <button class="hover:text-foreground transition-colors" @click="goBack">
        项目管理
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <span class="text-foreground font-medium">{{ project.name }}</span>
    </div>

    <PageHeader :title="project.name">
      <template #actions>
        <!-- 提交评审 -->
        <Button
          v-if="canSubmitReview"
          variant="default"
          :disabled="transitionMutation.isPending.value"
          @click="showSubmitReviewDialog = true"
        >
          <Send class="mr-2 h-4 w-4" />
          提交评审
        </Button>

        <!-- 批准项目 -->
        <Button
          v-if="canApprove"
          class="bg-green-600 hover:bg-green-700 text-white"
          :disabled="transitionMutation.isPending.value"
          @click="approveProject"
        >
          <CheckCircle class="mr-2 h-4 w-4" />
          批准
        </Button>

        <!-- 退回修改 -->
        <Button
          v-if="canRequestChanges"
          variant="destructive"
          :disabled="transitionMutation.isPending.value"
          @click="showRejectDialog = true"
        >
          <XCircle class="mr-2 h-4 w-4" />
          退回修改
        </Button>

        <!-- 重新打开 -->
        <Button
          v-if="canReopen"
          variant="outline"
          :disabled="transitionMutation.isPending.value"
          @click="reopenProject"
        >
          <RotateCcw class="mr-2 h-4 w-4" />
          重新打开
        </Button>

        <!-- 归档 -->
        <Button
          v-if="canArchive"
          variant="outline"
          class="text-muted-foreground"
          :disabled="transitionMutation.isPending.value"
          @click="archiveProject"
        >
          <Archive class="mr-2 h-4 w-4" />
          归档
        </Button>

        <!-- 恢复 -->
        <Button
          v-if="canRestore"
          variant="outline"
          :disabled="transitionMutation.isPending.value"
          @click="restoreProject"
        >
          <ArchiveRestore class="mr-2 h-4 w-4" />
          恢复项目
        </Button>

        <Button
          v-if="canTransferOwner"
          variant="outline"
          @click="showTransferOwnerDialog = true"
        >
          转交负责人
        </Button>
        <Button v-if="canEditProject" variant="outline" @click="editProject">
          编辑项目
        </Button>
        <Button
          variant="outline"
          @click="router.push(`/projects/${projectId}/brief`)"
        >
          管理 Brief
        </Button>
        <Button
          variant="outline"
          @click="router.push(`/projects/${projectId}/assets`)"
        >
          管理素材
        </Button>
        <div
          v-if="!isArchived"
          :title="canEnterDesignWorkspace ? '' : '请先完成 Brief 准备工作'"
          class="inline-block"
        >
          <Button
            :disabled="!canEnterDesignWorkspace"
            @click="router.push(`/projects/${projectId}/design`)"
          >
            进入设计大厅
          </Button>
        </div>
      </template>
    </PageHeader>

    <div class="grid gap-6 md:grid-cols-3">
      <!-- Info Card -->
      <div class="md:col-span-1 space-y-6">
        <div
          class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
        >
          <div class="p-6 border-b bg-muted/20">
            <div class="flex justify-between items-start mb-4">
              <div
                class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <FolderKanban class="h-6 w-6 text-primary" />
              </div>
              <StatusBadge :status="project.status" />
            </div>
            <h2 class="text-xl font-bold">{{ project.name }}</h2>
            <div class="mt-2 text-sm">
              <span class="text-muted-foreground">客户：</span>
              <button
                class="text-primary hover:underline font-medium"
                @click="viewCustomer"
              >
                {{ project.customerName }}
              </button>
            </div>
          </div>

          <div class="p-6 space-y-4">
            <div class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <User class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">负责人</p>
                <p class="text-sm text-muted-foreground">
                  {{ project.ownerName }}
                </p>
              </div>
            </div>

            <div v-if="project.exhibitionName" class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <MapPin class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">展会名称</p>
                <p class="text-sm text-muted-foreground">
                  {{ project.exhibitionName }}
                </p>
                <p
                  v-if="project.exhibitionVenue"
                  class="text-sm text-muted-foreground mt-0.5"
                >
                  {{ project.exhibitionVenue }}
                  <span v-if="project.boothNumber"
                    >| {{ project.boothNumber }}</span
                  >
                </p>
              </div>
            </div>

            <div v-if="project.exhibitionDate" class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <Calendar class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">展会日期</p>
                <p class="text-sm text-muted-foreground">
                  {{ project.exhibitionDate }}
                </p>
              </div>
            </div>

            <div v-if="project.deliveryDeadline" class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <Calendar class="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p class="text-sm font-medium">交付截止日期</p>
                <p class="text-sm text-destructive font-medium">
                  {{ project.deliveryDeadline }}
                </p>
              </div>
            </div>
          </div>

          <div v-if="project.notes" class="p-6 border-t bg-muted/10">
            <p class="text-sm font-medium mb-2">备注信息</p>
            <p class="text-sm text-muted-foreground whitespace-pre-wrap">
              {{ project.notes }}
            </p>
          </div>

          <!-- 退回原因 -->
          <div
            v-if="project.rejectionReason"
            class="p-4 border-t bg-destructive/5 rounded-b-xl"
          >
            <p class="text-sm font-medium text-destructive mb-1">退回原因</p>
            <p class="text-sm text-destructive/80 whitespace-pre-wrap">
              {{ project.rejectionReason }}
            </p>
          </div>
        </div>
      </div>

      <!-- Members Management -->
      <div class="md:col-span-2 space-y-6">
        <div
          class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
        >
          <div class="p-6 border-b flex justify-between items-center">
            <div class="flex items-center gap-2">
              <Users class="h-5 w-5 text-muted-foreground" />
              <h3 class="font-semibold text-lg">项目成员</h3>
            </div>
            <Button
              v-if="canManageMembers"
              size="sm"
              @click="showAddMemberDialog = true"
            >
              <Plus class="mr-2 h-4 w-4" />
              添加成员
            </Button>
          </div>

          <div class="p-0">
            <div v-if="isLoadingMembers" class="p-8 flex justify-center">
              <div
                class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
              />
            </div>

            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead>成员姓名</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead class="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!membersData || membersData.length === 0">
                  <TableCell
                    colspan="4"
                    class="h-24 text-center text-muted-foreground"
                  >
                    暂无成员数据
                  </TableCell>
                </TableRow>

                <TableRow
                  v-for="member in membersData || []"
                  :key="member.userId"
                >
                  <TableCell class="font-medium">
                    {{ member.userName }}
                    <span
                      v-if="member.userId === project.ownerId"
                      class="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                      >负责人</span
                    >
                  </TableCell>
                  <TableCell>{{ member.userEmail }}</TableCell>
                  <TableCell>
                    <span class="text-xs border px-2 py-1 rounded-full">{{
                      member.userRole
                    }}</span>
                  </TableCell>
                  <TableCell class="text-right">
                    <Button
                      v-if="
                        canTransferOwner && member.userId !== project.ownerId
                      "
                      variant="ghost"
                      size="sm"
                      class="mr-2"
                      @click="transferOwner(member.userId)"
                    >
                      设为负责人
                    </Button>
                    <Button
                      v-if="
                        canManageMembers && member.userId !== project.ownerId
                      "
                      variant="ghost"
                      size="icon"
                      class="text-destructive hover:text-destructive hover:bg-destructive/10"
                      @click="removeMember(member.userId)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Member Dialog -->
    <Dialog
      :open="showAddMemberDialog"
      @update:open="showAddMemberDialog = $event"
    >
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>添加项目成员</DialogTitle>
          <DialogDescription>
            选择用户加入当前项目，他们将能够查看和协作项目内容。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="flex flex-col gap-2">
            <select
              v-model="selectedUserId"
              class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="" disabled>选择要添加的用户</option>
              <option v-for="u in availableUsers" :key="u.id" :value="u.id">
                {{ u.displayName }} ({{ u.email }})
              </option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddMemberDialog = false">
            取消
          </Button>
          <Button
            type="button"
            :disabled="!selectedUserId || addMemberMutation.isPending.value"
            @click="addMember"
          >
            {{ addMemberMutation.isPending.value ? '添加中...' : '确认添加' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Transfer Owner Dialog -->
    <Dialog
      :open="showTransferOwnerDialog"
      @update:open="showTransferOwnerDialog = $event"
    >
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>转交负责人</DialogTitle>
          <DialogDescription>
            选择一个新的负责人，他们将拥有项目的管理权限。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="flex flex-col gap-2">
            <select
              v-model="transferUserId"
              class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="" disabled>选择新负责人</option>
              <option
                v-for="m in (membersData || []).filter(
                  (m: { userId: string }) => m.userId !== project?.ownerId,
                )"
                :key="m.userId"
                :value="m.userId"
              >
                {{ m.userName }} ({{ m.userEmail }})
              </option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showTransferOwnerDialog = false">
            取消
          </Button>
          <Button
            type="button"
            :disabled="!transferUserId || transferOwnerMutation.isPending.value"
            @click="() => transferOwner()"
          >
            {{
              transferOwnerMutation.isPending.value ? '转交中...' : '确认转交'
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 提交评审确认 Dialog -->
    <Dialog
      :open="showSubmitReviewDialog"
      @update:open="showSubmitReviewDialog = $event"
    >
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>提交评审</DialogTitle>
          <DialogDescription>
            项目将进入评审状态，Brief 和选图将被锁定，无法新建生成任务。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showSubmitReviewDialog = false"
            >取消</Button
          >
          <Button
            type="button"
            :disabled="transitionMutation.isPending.value"
            @click="submitReview"
          >
            {{ transitionMutation.isPending.value ? '提交中...' : '确认提交' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 退回修改 Dialog -->
    <Dialog :open="showRejectDialog" @update:open="showRejectDialog = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>退回修改</DialogTitle>
          <DialogDescription>
            请说明退回原因，项目将返回设计中状态。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <textarea
            v-model="rejectComment"
            rows="4"
            placeholder="请输入退回原因..."
            class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="
              showRejectDialog = false;
              rejectComment = '';
            "
            >取消</Button
          >
          <Button
            variant="destructive"
            type="button"
            :disabled="
              !rejectComment.trim() || transitionMutation.isPending.value
            "
            @click="requestChanges"
          >
            {{ transitionMutation.isPending.value ? '退回中...' : '确认退回' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
