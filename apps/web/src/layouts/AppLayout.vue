<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  ClipboardList,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Archive,
} from '@lucide/vue';
import { Avatar, AvatarFallback } from '../components/ui/avatar/index.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu/index.js';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet/index.js';
import { Button } from '../components/ui/button/index.js';

const route = useRoute();
const { user, logout } = useAuth();

const isCollapsed = ref(false);
const isMobileMenuOpen = ref(false);

const navigation = [
  { name: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
  { name: '客户管理', href: '/customers', icon: Building2 },
  { name: '项目管理', href: '/projects', icon: FolderKanban },
  { name: '任务中心', href: '/tasks', icon: ClipboardList },
  { name: '历史案例库', href: '/cases', icon: Archive },
];

const currentRouteName = computed(() => {
  if (route.name === 'dashboard') return '仪表盘';
  if (route.path.startsWith('/customers')) return '客户管理';
  if (route.path.startsWith('/projects')) return '项目管理';
  if (route.path.startsWith('/tasks')) return '任务中心';
  if (route.path.startsWith('/cases')) return '历史案例库';
  return '';
});

async function handleLogout() {
  await logout();
}
</script>

<template>
  <div class="flex min-h-screen w-full bg-background">
    <!-- Desktop Sidebar -->
    <aside
      class="hidden md:flex flex-col border-r bg-sidebar transition-all duration-300"
      :class="isCollapsed ? 'w-[64px]' : 'w-[240px]'"
    >
      <div class="flex h-14 items-center justify-between border-b px-3">
        <div
          class="flex items-center gap-2 overflow-hidden"
          :class="isCollapsed ? 'w-0' : 'w-auto'"
        >
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <LayoutDashboard class="h-4 w-4" />
          </div>
          <span
            class="truncate font-semibold text-sidebar-foreground transition-opacity"
            :class="isCollapsed ? 'opacity-0' : 'opacity-100'"
          >
            展台 AI
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 shrink-0"
          @click="isCollapsed = !isCollapsed"
        >
          <ChevronRight v-if="isCollapsed" class="h-4 w-4" />
          <ChevronLeft v-else class="h-4 w-4" />
        </Button>
      </div>

      <nav class="flex-1 space-y-1 p-2">
        <router-link
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            route.path.startsWith(item.href)
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
            isCollapsed ? 'justify-center px-0' : '',
          ]"
          :title="isCollapsed ? item.name : ''"
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          <span v-if="!isCollapsed" class="truncate">{{ item.name }}</span>
        </router-link>
      </nav>

      <div class="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              class="w-full justify-start hover:bg-sidebar-accent"
              :class="isCollapsed ? 'px-0 justify-center' : 'px-2'"
            >
              <Avatar class="h-6 w-6 mr-2 shrink-0">
                <AvatarFallback class="bg-primary/10 text-primary text-xs">
                  {{ user?.displayName?.charAt(0)?.toUpperCase() || 'U' }}
                </AvatarFallback>
              </Avatar>
              <div
                v-if="!isCollapsed"
                class="flex flex-1 items-center justify-between overflow-hidden"
              >
                <div class="flex flex-col items-start truncate">
                  <span class="text-sm font-medium truncate w-full">{{
                    user?.displayName || '用户'
                  }}</span>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-56">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="text-destructive" @click="handleLogout">
              <LogOut class="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>

    <!-- Mobile Header -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <header
        class="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6"
      >
        <Sheet v-model:open="isMobileMenuOpen">
          <SheetTrigger as-child>
            <Button variant="ghost" size="icon" class="md:hidden shrink-0">
              <Menu class="h-5 w-5" />
              <span class="sr-only">打开菜单</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="w-[240px] p-0 flex flex-col">
            <SheetHeader
              class="h-14 border-b px-4 flex items-center justify-start flex-row gap-2"
            >
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <LayoutDashboard class="h-4 w-4" />
              </div>
              <SheetTitle class="m-0! text-left">展台 AI</SheetTitle>
            </SheetHeader>
            <nav class="flex-1 space-y-1 p-2">
              <router-link
                v-for="item in navigation"
                :key="item.name"
                :to="item.href"
                class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                :class="
                  route.path.startsWith(item.href)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                "
                @click="isMobileMenuOpen = false"
              >
                <component :is="item.icon" class="h-4 w-4" />
                {{ item.name }}
              </router-link>
            </nav>
            <div class="border-t p-4">
              <div class="flex items-center gap-3 mb-4">
                <Avatar class="h-8 w-8">
                  <AvatarFallback class="bg-primary/10 text-primary">
                    {{ user?.displayName?.charAt(0)?.toUpperCase() || 'U' }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <span class="text-sm font-medium">{{
                    user?.displayName || '用户'
                  }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    user?.email || ''
                  }}</span>
                </div>
              </div>
              <Button
                variant="outline"
                class="w-full justify-start text-destructive"
                @click="handleLogout"
              >
                <LogOut class="mr-2 h-4 w-4" />
                退出登录
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div class="flex flex-1 items-center justify-between">
          <div
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            {{ currentRouteName }}
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6 lg:p-8">
        <router-view />
      </main>
    </div>
  </div>
</template>
