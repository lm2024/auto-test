<template>
  <el-container class="app-container">
    <el-aside width="200px" class="app-aside">
      <div class="logo">接口测试平台</div>
      <el-menu :default-active="route.path" router>
        <el-menu-item index="/chain/list">
          <el-icon><List /></el-icon>
          <span>测试链路管理</span>
        </el-menu-item>
        <el-menu-item index="/execute/list">
          <el-icon><Document /></el-icon>
          <span>执行记录查询</span>
        </el-menu-item>
        <el-menu-item index="/account/list">
          <el-icon><User /></el-icon>
          <span>测试账号管理</span>
        </el-menu-item>
        <el-menu-item index="/dict/category">
          <el-icon><Collection /></el-icon>
          <span>分类字典管理</span>
        </el-menu-item>
        <el-menu-item index="/system/config">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { List, Document, Setting, User, Collection } from '@element-plus/icons-vue'
const route = useRoute()
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app {
  height: 100%;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-container {
  height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* ── Sidebar ── */
.app-aside {
  width: 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

/* ── Logo Area ── */
.logo {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.logo::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 0%, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
  pointer-events: none;
}

.logo::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.5), transparent);
}

.logo span {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
  position: relative;
  background: linear-gradient(135deg, #c7d2fe, #fff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Navigation Menu ── */
.el-menu {
  border-right: none;
  background: transparent;
  flex: 1;
  padding: 12px 8px;
}

.el-menu-item {
  color: rgba(191, 203, 217, 0.7);
  margin: 4px 0;
  border-radius: 12px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  height: 48px;
  line-height: 48px;
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
  background: #818cf8;
  border-radius: 0 2px 2px 0;
  transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.el-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e0e7ff;
  transform: translateX(2px);
}

.el-menu-item.is-active {
  color: #fff;
  background: rgba(99, 102, 241, 0.25);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.1);
}

.el-menu-item.is-active::before {
  height: 24px;
}

/* ── Main Content ── */
.app-main {
  flex: 1;
  background: #f5f3ff;
  padding: 24px;
  overflow-y: auto;
  position: relative;
}

.app-main::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(16, 185, 129, 0.04) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.app-main > *:not(router-view) {
  position: relative;
  z-index: 1;
}

/* ── Scrollbar ── */
.app-main::-webkit-scrollbar { width: 6px; }
.app-main::-webkit-scrollbar-track { background: transparent; }
.app-main::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 3px;
}
.app-main::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}

/* ── Element Plus Overrides ── */
:deep(.el-menu--collapse) {
  width: 72px;
}
:deep(.el-menu--collapse .el-menu-item) {
  padding: 0;
  margin: 4px 6px;
  height: 48px;
  border-radius: 12px;
}
</style>
