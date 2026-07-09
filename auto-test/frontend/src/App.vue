<template>
  <!-- 登录页：全屏，无菜单 -->
  <div v-if="isLoginPage" class="login-wrapper">
    <router-view />
  </div>

  <!-- 已登录：侧边栏 + 主内容 -->
  <el-container v-else class="app-container">
    <el-aside :width="asideWidth + 'px'" class="app-aside" ref="asideRef">
      <div class="logo">
        <span v-if="!isCollapsed">接口测试平台</span>
        <span v-else>AT</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="isCollapsed"
        :collapse-transition="false"
        router
      >
        <el-menu-item index="/chain/list">
          <el-icon><List /></el-icon>
          <template #title>测试链路管理</template>
        </el-menu-item>
        <el-menu-item index="/execute/list">
          <el-icon><Document /></el-icon>
          <template #title>执行记录查询</template>
        </el-menu-item>
        <el-menu-item index="/account/list">
          <el-icon><User /></el-icon>
          <template #title>测试账号管理</template>
        </el-menu-item>
        <el-menu-item index="/dict/category">
          <el-icon><Collection /></el-icon>
          <template #title>分类字典管理</template>
        </el-menu-item>
        <el-menu-item index="/user/list" v-if="user && user.role === 'ADMIN'">
          <el-icon><User /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>
        <el-menu-item index="/scheduled-task" v-if="user && user.role === 'ADMIN'">
          <el-icon><Timer /></el-icon>
          <template #title>定时任务</template>
        </el-menu-item>
        <el-menu-item index="/plugin/download">
          <el-icon><Monitor /></el-icon>
          <template #title>插件下载</template>
        </el-menu-item>
        <el-menu-item index="/system/config">
          <el-icon><Setting /></el-icon>
          <template #title>系统设置</template>
        </el-menu-item>
      </el-menu>

      <div class="user-info" v-if="user">
        <el-dropdown trigger="click">
          <span class="user-name">
            <el-icon><User /></el-icon>
            {{ user.displayName || user.username }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换到亮色' : '切换到暗色'">
        <el-icon :size="18">
          <Sunny v-if="isDark" />
          <Moon v-else />
        </el-icon>
      </div>
      <div class="collapse-btn" @click="toggleCollapse">
        <el-icon :size="18">
          <Fold v-if="!isCollapsed" />
          <Expand v-else />
        </el-icon>
      </div>
    </el-aside>
    <div
      class="resize-handle"
      @mousedown="startResize"
      v-show="!isCollapsed"
    ></div>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { List, Document, Setting, User, Collection, Fold, Expand, Timer, Monitor, Sunny, Moon } from '@element-plus/icons-vue'
import { getUser, logout } from './utils/auth'

const route = useRoute()
const router = useRouter()
const user = ref(getUser())
// 登录后 localStorage 写入了最新的 user（含 role），但 App.vue 作为根布局只挂载一次，
// 不会因登录重新执行 setup，因此需要监听路由变化重新读取，避免「用户管理/定时任务」等
// 依赖 user.role 的菜单项与右上角用户下拉因 user 始终是 null 而被隐藏。
watch(() => route.fullPath, () => { user.value = getUser() })
const isLoginPage = computed(() => route.path === '/login')
const asideRef = ref(null)

const isCollapsed = ref(localStorage.getItem('menuCollapsed') === 'true')
const asideWidth = ref(parseInt(localStorage.getItem('menuWidth') || '240'))
const isResizing = ref(false)

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem('menuCollapsed', isCollapsed.value)
  if (isCollapsed.value) {
    asideWidth.value = 64
  } else {
    asideWidth.value = parseInt(localStorage.getItem('menuWidth') || '240')
  }
}

const startResize = (e) => {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = asideWidth.value

  const onMouseMove = (e) => {
    if (!isResizing.value) return
    const diff = e.clientX - startX
    let newWidth = startWidth + diff
    if (newWidth < 64) newWidth = 64
    if (newWidth > 400) newWidth = 400
    asideWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizing.value = false
    localStorage.setItem('menuWidth', asideWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

onMounted(() => {
  if (isCollapsed.value) {
    asideWidth.value = 64
  }
  user.value = getUser()
})

const handleLogout = () => {
  logout()
  router.push('/login')
}

// ── 亮/暗主题切换 ──
const isDark = ref(document.documentElement.classList.contains('dark'))
const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app {
  height: 100%;
  font-family: var(--sb-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  background: var(--sb-bg, #1c1c1c);
  color: var(--sb-text, #ededed);
}

.login-wrapper {
  height: 100vh;
  width: 100%;
}

.app-container {
  height: 100vh;
  display: flex;
  background: var(--sb-bg, #1c1c1c);
}

/* ── Sidebar ── */
.app-aside {
  min-width: 64px;
  display: flex;
  flex-direction: column;
  background: var(--sb-surface, #202020);
  border-right: 1px solid var(--sb-border, rgba(255, 255, 255, 0.08));
  z-index: 10;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* ── Resize Handle ── */
.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 11;
  flex-shrink: 0;
}

.resize-handle:hover {
  background: rgba(62, 207, 142, 0.4);
}

/* ── Logo Area ── */
.logo {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid var(--sb-border, rgba(255, 255, 255, 0.08));
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.logo::before {
  content: '';
  position: absolute;
  left: 18px;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--sb-green, #3ecf8e);
  box-shadow: 0 0 12px rgba(62, 207, 142, 0.5);
}

.logo span {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
  padding-left: 16px;
}

/* ── Collapse Button ── */
.collapse-btn {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--sb-text-mute, #8b8b8b);
  border-top: 1px solid var(--sb-border, rgba(255, 255, 255, 0.08));
  transition: all 0.25s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--sb-text, #ededed);
}

/* ── Theme Toggle ── */
.theme-toggle {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--sb-text-mute, #8b8b8b);
  border-top: 1px solid var(--sb-border, rgba(255, 255, 255, 0.08));
  transition: all 0.25s;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--sb-green, #3ecf8e);
}

/* ── User Info ── */
.user-info {
  padding: 12px 16px;
  border-top: 1px solid var(--sb-border, rgba(255, 255, 255, 0.08));
  cursor: pointer;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--sb-text-secondary, #b2b2b2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-name:hover {
  color: var(--sb-text, #ededed);
}

/* ── Navigation Menu ── */
.el-menu {
  border-right: none;
  background: transparent;
  flex: 1;
  padding: 12px 8px;
}

.el-menu-item {
  color: var(--sb-text-mute, #8b8b8b);
  margin: 4px 0;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  height: 44px;
  line-height: 44px;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  overflow: hidden;
}

.el-menu-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: var(--sb-green, #3ecf8e);
  border-radius: 0 2px 2px 0;
  transition: height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.el-menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--sb-text, #ededed);
}

.el-menu-item.is-active {
  color: var(--sb-green-soft, #4ade80);
  background: rgba(62, 207, 142, 0.12);
}

.el-menu-item.is-active::before {
  height: 20px;
}

/* ── Main Content ── */
.app-main {
  flex: 1;
  background: var(--sb-bg, #1c1c1c);
  padding: 24px;
  overflow-y: auto;
  position: relative;
}

.app-main > *:not(router-view) {
  position: relative;
  z-index: 1;
}

/* ── Scrollbar ── */
.app-main::-webkit-scrollbar { width: 8px; }
.app-main::-webkit-scrollbar-track { background: transparent; }
.app-main::-webkit-scrollbar-thumb {
  background: rgba(62, 207, 142, 0.3);
  border-radius: 4px;
}
.app-main::-webkit-scrollbar-thumb:hover {
  background: rgba(62, 207, 142, 0.5);
}

/* ── Element Plus Overrides ── */
:deep(.el-menu--collapse) {
  width: 64px;
}
:deep(.el-menu--collapse .el-menu-item) {
  padding: 0;
  margin: 4px 6px;
  height: 44px;
  border-radius: 6px;
}
:deep(.el-menu--collapse .el-menu-item span) {
  display: none;
}
</style>
