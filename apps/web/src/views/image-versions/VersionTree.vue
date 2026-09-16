<script setup lang="ts">
import { computed } from 'vue';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ImageVersion } from '@exhibition/contracts';

interface Props {
  versions: ImageVersion[];
  selectedVersionId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [version: ImageVersion];
  viewVersion: [version: ImageVersion];
}>();

// 构建版本树结构
interface VersionNode {
  version: ImageVersion;
  children: VersionNode[];
  level: number;
}

const versionTree = computed(() => {
  const versionMap = new Map<string, VersionNode>();
  const roots: VersionNode[] = [];

  // 初始化所有节点
  props.versions.forEach((version) => {
    versionMap.set(version.id, {
      version,
      children: [],
      level: 0,
    });
  });

  // 构建树结构
  props.versions.forEach((version) => {
    const node = versionMap.get(version.id)!;
    if (version.parentVersionId) {
      const parent = versionMap.get(version.parentVersionId);
      if (parent) {
        parent.children.push(node);
        node.level = parent.level + 1;
      } else {
        // 父节点不在当前列表中，作为根节点
        roots.push(node);
      }
    } else {
      // 没有父节点，是根节点
      roots.push(node);
    }
  });

  // 按创建时间排序根节点
  roots.sort(
    (a, b) =>
      new Date(a.version.createdAt).getTime() -
      new Date(b.version.createdAt).getTime(),
  );

  return roots;
});

// 检查版本是否在选中版本的祖先链上
function isAncestor(versionId: string, targetId: string | null): boolean {
  if (!targetId) return false;
  if (versionId === targetId) return true;

  const target = props.versions.find((v) => v.id === targetId);
  if (!target || !target.parentVersionId) return false;

  return isAncestor(versionId, target.parentVersionId);
}

function getImageUrl(assetId: string) {
  return `/api/v1/assets/${assetId}/download`;
}

// 将树展平为可渲染的列表
interface FlatNode {
  node: VersionNode;
  isAncestor: boolean;
}

const flatNodes = computed(() => {
  const result: FlatNode[] = [];

  function flatten(node: VersionNode) {
    result.push({
      node,
      isAncestor: isAncestor(node.version.id, props.selectedVersionId),
    });
    node.children.forEach(flatten);
  }

  versionTree.value.forEach(flatten);
  return result;
});
</script>

<template>
  <Card class="border-slate-800 bg-slate-900">
    <div class="space-y-4 p-6">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-100">版本历史树</h3>
        <Badge variant="outline" class="border-slate-700 bg-slate-800">
          {{ props.versions.length }} 个版本
        </Badge>
      </div>

      <div
        v-if="flatNodes.length === 0"
        class="py-8 text-center text-sm text-slate-400"
      >
        暂无版本历史
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="item in flatNodes"
          :key="item.node.version.id"
          class="flex gap-2"
        >
          <!-- 缩进和连接线 -->
          <div v-if="item.node.level > 0" class="flex items-start pt-2">
            <div
              v-for="i in item.node.level"
              :key="i"
              class="h-full w-8 border-l-2 border-slate-700"
            />
            <div
              class="h-4 w-4 rounded-bl border-b-2 border-l-2 border-slate-700"
            />
          </div>

          <!-- 版本卡片 -->
          <div
            class="flex-1"
            :class="{
              'border-cyan-500 bg-cyan-950/20':
                props.selectedVersionId === item.node.version.id,
              'border-cyan-500/30 bg-cyan-950/10':
                item.isAncestor &&
                props.selectedVersionId !== item.node.version.id,
              'border-slate-700 bg-slate-900 hover:border-slate-600':
                !item.isAncestor &&
                props.selectedVersionId !== item.node.version.id,
            }"
          >
            <Card class="group overflow-hidden border transition-colors">
              <div class="flex items-start gap-3 p-3">
                <!-- 缩略图 -->
                <div
                  class="h-16 w-16 flex-shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-950"
                >
                  <img
                    :src="getImageUrl(item.node.version.assetId)"
                    :alt="`V${item.node.version.sequence}`"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <!-- 版本信息 -->
                <div class="flex-1 space-y-1">
                  <div class="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      class="border-slate-700 bg-slate-800 text-xs"
                    >
                      V{{ item.node.version.sequence }}
                    </Badge>
                    <Badge
                      v-if="props.selectedVersionId === item.node.version.id"
                      class="border-cyan-500/30 bg-cyan-500/20 text-xs text-cyan-400"
                    >
                      当前选中
                    </Badge>
                    <Badge
                      v-else-if="item.isAncestor"
                      variant="outline"
                      class="border-cyan-500/30 text-xs text-cyan-400"
                    >
                      祖先版本
                    </Badge>
                  </div>

                  <div class="text-xs text-slate-400">
                    {{ item.node.version.width }} ×
                    {{ item.node.version.height }}
                  </div>

                  <div class="text-xs text-slate-500">
                    {{
                      new Date(item.node.version.createdAt).toLocaleString(
                        'zh-CN',
                      )
                    }}
                  </div>

                  <!-- 分支信息 -->
                  <div
                    v-if="item.node.children.length > 0"
                    class="text-xs text-slate-500"
                  >
                    {{ item.node.children.length }} 个派生版本
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex flex-col gap-1">
                  <Button
                    v-if="props.selectedVersionId !== item.node.version.id"
                    size="sm"
                    variant="outline"
                    class="h-7 border-slate-700 bg-slate-900 text-xs hover:bg-slate-800"
                    @click="emit('select', item.node.version)"
                  >
                    选中
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-7 text-xs"
                    @click="emit('viewVersion', item.node.version)"
                  >
                    查看
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>
