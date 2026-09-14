<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useProjectQuery,
  useProjectMembersQuery,
  useRemoveProjectMemberMutation,
  useAddProjectMemberMutation,
  useUserOptionsQuery,
} from '../../api/queries/projects.js';
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
const projectId = computed(() => route.params.id as string);

const { data: project, isLoading } = useProjectQuery(projectId.value);
const { data: membersData, isLoading: isLoadingMembers } =
  useProjectMembersQuery(projectId.value);

const removeMemberMutation = useRemoveProjectMemberMutation();
const addMemberMutation = useAddProjectMemberMutation();
const { data: usersData } = useUserOptionsQuery();

const showAddMemberDialog = ref(false);
const selectedUserId = ref('');

function goBack() {
  router.push('/projects');
}

function viewCustomer() {
  if (project.value?.customerId) {
    router.push(`/customers/${project.value.customerId}`);
  }
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
        <Button variant="outline" disabled>编辑项目 (暂未开放)</Button>
        <Button disabled>进入设计大厅</Button>
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
            <Button size="sm" @click="showAddMemberDialog = true">
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
                      v-if="member.userId !== project.ownerId"
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
  </div>
</template>
