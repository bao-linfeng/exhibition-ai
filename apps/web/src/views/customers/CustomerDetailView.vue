<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCustomerQuery } from '../../api/queries/customers.js';
import { useProjectsQuery } from '../../api/queries/projects.js';
import { useUserStore } from '../../stores/user.js';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  ChevronRight,
  FolderKanban,
} from '@lucide/vue';
import { Button } from '../../components/ui/button/index.js';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const customerId = computed(() => route.params.id as string);

const { data: customer, isLoading } = useCustomerQuery(customerId.value);
const { data: projectsData, isLoading: isLoadingProjects } = useProjectsQuery({
  customerId: customerId.value,
});

function goBack() {
  router.push('/customers');
}

function editCustomer() {
  router.push(`/customers/${customerId.value}/edit`);
}

function viewProject(id: string) {
  router.push(`/projects/${id}`);
}
</script>

<template>
  <div v-if="isLoading" class="flex justify-center p-12">
    <div
      class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
    />
  </div>

  <div v-else-if="customer">
    <div class="mb-4 flex items-center text-sm text-muted-foreground">
      <button class="hover:text-foreground transition-colors" @click="goBack">
        客户管理
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <span class="text-foreground font-medium">{{ customer.name }}</span>
    </div>

    <PageHeader :title="customer.name">
      <template #actions>
        <Button
          v-if="userStore.canManageCustomers"
          variant="outline"
          @click="editCustomer"
          >编辑资料</Button
        >
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
                <Building2 class="h-6 w-6 text-primary" />
              </div>
              <StatusBadge :status="customer.status" />
            </div>
            <h2 class="text-xl font-bold">{{ customer.name }}</h2>
            <p
              v-if="customer.industry"
              class="text-sm text-muted-foreground mt-1"
            >
              {{ customer.industry }}
            </p>
          </div>
          <div class="p-6 space-y-4">
            <div v-if="customer.contactName" class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <Briefcase class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">联系人</p>
                <p class="text-sm text-muted-foreground">
                  {{ customer.contactName }}
                </p>
              </div>
            </div>
            <div v-if="customer.contactPhone" class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <Phone class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">联系电话</p>
                <p class="text-sm text-muted-foreground">
                  {{ customer.contactPhone }}
                </p>
              </div>
            </div>
            <div v-if="customer.contactEmail" class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <Mail class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">联系邮箱</p>
                <p class="text-sm text-muted-foreground">
                  {{ customer.contactEmail }}
                </p>
              </div>
            </div>
            <div v-if="customer.address" class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <MapPin class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">公司地址</p>
                <p class="text-sm text-muted-foreground">
                  {{ customer.address }}
                </p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="mt-0.5 text-muted-foreground">
                <Calendar class="h-4 w-4" />
              </div>
              <div>
                <p class="text-sm font-medium">创建时间</p>
                <p class="text-sm text-muted-foreground">
                  {{ new Date(customer.createdAt).toLocaleDateString() }}
                </p>
              </div>
            </div>
          </div>
          <div v-if="customer.notes" class="p-6 border-t bg-muted/10">
            <p class="text-sm font-medium mb-2">备注信息</p>
            <p class="text-sm text-muted-foreground whitespace-pre-wrap">
              {{ customer.notes }}
            </p>
          </div>
        </div>
      </div>

      <!-- Projects List -->
      <div class="md:col-span-2">
        <div
          class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden h-full"
        >
          <div class="p-6 border-b flex justify-between items-center">
            <h3 class="font-semibold text-lg">相关项目</h3>
            <Button
              v-if="userStore.canCreateProject"
              size="sm"
              variant="outline"
              @click="
                router.push({
                  path: '/projects/new',
                  query: { customerId: customer.id },
                })
              "
            >
              新建项目
            </Button>
          </div>

          <div class="p-0">
            <div v-if="isLoadingProjects" class="p-8 flex justify-center">
              <div
                class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
              />
            </div>

            <div
              v-else-if="!projectsData?.data || projectsData.data.length === 0"
              class="p-12 text-center text-muted-foreground"
            >
              <FolderKanban class="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>该客户暂无相关项目</p>
            </div>

            <div v-else class="divide-y">
              <div
                v-for="project in projectsData.data"
                :key="project.id"
                class="p-4 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors"
                @click="viewProject(project.id)"
              >
                <div class="flex flex-col gap-1">
                  <span class="font-medium">{{ project.name }}</span>
                  <span
                    class="text-xs text-muted-foreground flex items-center gap-2"
                  >
                    负责人: {{ project.ownerName }}
                    <span v-if="project.exhibitionDate"
                      >· {{ project.exhibitionDate }}</span
                    >
                  </span>
                </div>
                <StatusBadge :status="project.status" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
