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
import { List, Document, Setting } from '@element-plus/icons-vue'
const route = useRoute()
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; }
.app-container { height: 100vh; }
.app-aside {
  background: #304156;
  color: #fff;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  border-bottom: 1px solid #3d4a5a;
}
.el-menu {
  border-right: none;
  background: #304156;
}
.el-menu-item {
  color: #bfcbd9;
}
.el-menu-item:hover {
  background: #263445;
}
.el-menu-item.is-active {
  color: #409eff;
}
.app-main {
  background: #f0f2f5;
  padding: 20px;
}
</style>
