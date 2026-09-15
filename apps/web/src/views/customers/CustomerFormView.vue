<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
} from '../../api/queries/customers.js';
import { useUserStore } from '../../stores/user.js';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Input } from '../../components/ui/input/index.js';
import { Label } from '../../components/ui/label/index.js';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const isEdit = computed(() => route.path.includes('/edit'));
const customerId = computed(() => route.params.id as string);

const { data: customer, isLoading: isLoadingCustomer } = useCustomerQuery(
  isEdit.value ? customerId.value : '',
);

const createMutation = useCreateCustomerMutation();
const updateMutation = useUpdateCustomerMutation();

const formData = ref({
  name: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  industry: '',
  address: '',
  notes: '',
  status: 'active' as 'active' | 'inactive',
  expectedRevision: 0,
});

watch(
  customer,
  (newVal) => {
    if (newVal) {
      formData.value = {
        name: newVal.name,
        contactName: newVal.contactName || '',
        contactPhone: newVal.contactPhone || '',
        contactEmail: newVal.contactEmail || '',
        industry: newVal.industry || '',
        address: newVal.address || '',
        notes: newVal.notes || '',
        status: newVal.status,
        expectedRevision: newVal.revision,
      };
    }
  },
  { immediate: true },
);

async function save() {
  if (!formData.value.name.trim()) {
    // simple validation
    return;
  }

  const payload = {
    name: formData.value.name,
    contactName: formData.value.contactName || undefined,
    contactPhone: formData.value.contactPhone || undefined,
    contactEmail: formData.value.contactEmail || undefined,
    industry: formData.value.industry || undefined,
    address: formData.value.address || undefined,
    notes: formData.value.notes || undefined,
  };

  try {
    if (isEdit.value) {
      await updateMutation.mutateAsync({
        id: customerId.value,
        body: {
          ...payload,
          status: formData.value.status,
          expectedRevision: formData.value.expectedRevision,
        },
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
    router.push('/customers');
  } catch (err) {
    console.error('Failed to save customer', err);
  }
}

function cancel() {
  if (isEdit.value) {
    router.push(`/customers/${customerId.value}`);
  } else {
    router.push('/customers');
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="isEdit ? '编辑客户' : '新建客户'"
      :description="isEdit ? '修改客户信息' : '添加新的客户记录'"
    />

    <div v-if="isEdit && isLoadingCustomer" class="flex justify-center p-8">
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
            >公司名称 <span class="text-destructive">*</span></Label
          >
          <Input
            id="name"
            v-model="formData.name"
            placeholder="请输入公司全称"
            required
          />
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="contactName">联系人</Label>
            <Input
              id="contactName"
              v-model="formData.contactName"
              placeholder="主要联系人姓名"
            />
          </div>
          <div class="space-y-2">
            <Label for="contactPhone">联系电话</Label>
            <Input
              id="contactPhone"
              v-model="formData.contactPhone"
              placeholder="联系电话"
            />
          </div>
          <div class="space-y-2 md:col-span-2">
            <Label for="contactEmail">联系邮箱</Label>
            <Input
              id="contactEmail"
              v-model="formData.contactEmail"
              type="email"
              placeholder="电子邮箱地址"
            />
          </div>
          <div class="space-y-2">
            <Label for="industry">所属行业</Label>
            <Input
              id="industry"
              v-model="formData.industry"
              placeholder="例如：医疗、科技、制造..."
            />
          </div>
          <div v-if="userStore.canDeactivateCustomer" class="space-y-2">
            <Label v-if="isEdit" for="status">状态</Label>
            <div v-if="isEdit" class="flex gap-4 items-center h-10">
              <label class="flex items-center gap-2">
                <input
                  v-model="formData.status"
                  type="radio"
                  value="active"
                  class="accent-primary"
                />
                <span class="text-sm">活跃</span>
              </label>
              <label class="flex items-center gap-2">
                <input
                  v-model="formData.status"
                  type="radio"
                  value="inactive"
                  class="accent-primary"
                />
                <span class="text-sm">非活跃</span>
              </label>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="address">公司地址</Label>
          <Input
            id="address"
            v-model="formData.address"
            placeholder="详细地址"
          />
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
          <Button
            type="submit"
            :disabled="
              createMutation.isPending.value || updateMutation.isPending.value
            "
          >
            {{
              createMutation.isPending.value || updateMutation.isPending.value
                ? '保存中...'
                : '保存'
            }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>
