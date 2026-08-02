<template>
  <!-- 登录页：全屏，无菜单 -->
  <div v-if="isLoginPage" class="login-wrapper">
    <router-view />
  </div>

  <!-- 已登录：侧边栏 + 主内容 -->
  <t-layout v-else class="app-container">
    <t-aside :width="asideWidth + 'px'" class="app-aside" ref="asideRef">
      <div class="logo">
        <span v-if="!isCollapsed">接口测试平台</span>
        <span v-else>AT</span>
      </div>
      <t-menu
        :value="route.path"
        :collapsed="isCollapsed"
        class="app-menu"
        @change="onMenuChange"
      >
        <t-menu-item value="/chain/list">
          <ViewModuleIcon />
          <span>测试链路管理</span>
        </t-menu-item>
        <t-menu-item value="/execute/list">
          <ArticleIcon />
          <span>执行记录查询</span>
        </t-menu-item>
        <t-menu-item value="/account/list">
          <UserIcon />
          <span>测试账号管理</span>
        </t-menu-item>
        <t-menu-item value="/dict/category">
          <FolderIcon />
          <span>分类字典管理</span>
        </t-menu-item>
        <t-menu-item value="/user/list" v-if="user && user.role === 'ADMIN'">
          <UserCircleIcon />
          <span>用户管理</span>
        </t-menu-item>
        <t-menu-item value="/scheduled-task" v-if="user && user.role === 'ADMIN'">
          <TimeIcon />
          <span>定时任务</span>
        </t-menu-item>
        <t-menu-item value="/plugin/download">
          <DesktopIcon />
          <span>插件下载</span>
        </t-menu-item>
        <t-menu-item value="/system/config">
          <SettingIcon />
          <span>系统设置</span>
        </t-menu-item>
      </t-menu>

      <div class="user-info" v-if="user">
        <t-dropdown trigger="click">
          <span class="user-name">
            <UserCircleIcon />
            {{ user.displayName || user.username }}
          </span>
          <t-dropdown-menu>
            <t-dropdown-item value="logout" @click="handleLogout">退出登录</t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
      </div>
      <div class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换到亮色' : '切换到暗色'">
        <SunnyIcon v-if="isDark" style="font-size: 18px;" />
        <MoonIcon v-else style="font-size: 18px;" />
      </div>
      <div class="collapse-btn" @click="toggleCollapse">
        <ChevronLeftIcon v-if="!isCollapsed" style="font-size: 18px;" />
        <ChevronRightIcon v-else style="font-size: 18px;" />
      </div>
    </t-aside>
    <div
      class="resize-handle"
      @mousedown="startResize"
      v-show="!isCollapsed"
    ></div>
    <t-content class="app-main">
      <router-view />
    </t-content>
  </t-layout>
</template>

<script>
import {
  ViewModuleIcon, ArticleIcon, UserIcon, FolderIcon, UserCircleIcon,
  TimeIcon, DesktopIcon, SettingIcon, SunnyIcon, MoonIcon,
  ChevronLeftIcon, ChevronRightIcon
} from 'tdesign-icons-vue'
import { getUser, logout } from './utils/auth'

export default {
  name: 'App',
  components: {
    ViewModuleIcon, ArticleIcon, UserIcon, FolderIcon, UserCircleIcon,
    TimeIcon, DesktopIcon, SettingIcon, SunnyIcon, MoonIcon,
    ChevronLeftIcon, ChevronRightIcon
  },

  data() {
    return {
      user: getUser(),
      isCollapsed: localStorage.getItem('menuCollapsed') === 'true',
      asideWidth: parseInt(localStorage.getItem('menuWidth') || '240'),
      isResizing: false
    }
  },

  computed: {
    route() {
      return this.$route
    },
    isLoginPage() {
      return this.$route.path === '/login'
    },
    isDark() {
      return document.documentElement.classList.contains('dark')
    }
  },

  watch: {
    // 监听路由变化，重新读取 user（处理登录/登出后 role 变更）
    '$route.fullPath': function () {
      this.user = getUser()
    }
  },

  mounted() {
    if (this.isCollapsed) {
      this.asideWidth = 64
    }
    this.user = getUser()
  },

  methods: {
    onMenuChange(value) {
      this.$router.push(value)
    },
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
      localStorage.setItem('menuCollapsed', this.isCollapsed)
      if (this.isCollapsed) {
        this.asideWidth = 64
      } else {
        this.asideWidth = parseInt(localStorage.getItem('menuWidth') || '240')
      }
    },

    startResize(e) {
      this.isResizing = true
      const startX = e.clientX
      const startWidth = this.asideWidth

      const onMouseMove = (e) => {
        if (!this.isResizing) return
        const diff = e.clientX - startX
        let newWidth = startWidth + diff
        if (newWidth < 64) newWidth = 64
        if (newWidth > 400) newWidth = 400
        this.asideWidth = newWidth
      }

      const onMouseUp = () => {
        this.isResizing = false
        localStorage.setItem('menuWidth', this.asideWidth)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },

    handleLogout() {
      logout()
      this.$router.push('/login')
    },

    toggleTheme() {
      if (!this.isDark) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    }
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
  background: var(--sb-bg, #1c1c1c);
}

/* ── Sidebar ── */
.app-aside {
  min-width: 64px;
  flex-shrink: 0;
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
  flex-shrink: 0;
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
  color: var(--sb-text, #fff);
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
  flex-shrink: 0;
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
  flex-shrink: 0;
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
  flex-shrink: 0;
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
.app-menu {
  flex: 1;
  padding: 12px 8px;
  background: transparent;
  border-right: none;
  overflow-y: auto;
}

::v-deep .app-menu .t-menu__item {
  color: var(--sb-text-mute, #8b8b8b);
  margin: 4px 0;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  height: 44px;
  font-size: 14px;
  font-weight: 500;
  position: relative;
}

::v-deep .app-menu .t-menu__item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--sb-text, #ededed);
}

::v-deep .app-menu .t-menu__item.t-is-active {
  color: var(--sb-green-soft, #4ade80);
  background: rgba(62, 207, 142, 0.12);
}

::v-deep .app-menu .t-menu__item.t-is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--sb-green, #3ecf8e);
  border-radius: 0 2px 2px 0;
}

::v-deep .app-menu .t-menu__item .t-icon {
  font-size: 18px;
}

/* ── Main Content ── */
.app-main {
  background: var(--sb-bg, #1c1c1c);
  padding: 24px;
  overflow-y: auto;
  position: relative;
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
</style>
