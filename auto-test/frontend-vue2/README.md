# 接口测试平台 - Vue 2 前端

## 项目简介

这是原 Vue 3 前端项目的完整 Vue 2 转换版本。所有功能和页面已完整复刻，使用 Element UI 替代 Element Plus。

## 技术栈

- **Vue**: 2.7.16 (LTS)
- **UI 框架**: Element UI 2.15.14
- **路由**: Vue Router 3.6.5
- **HTTP**: Axios 1.6.0 + vue-axios 3.5.2
- **构建工具**: Webpack 5.89.0
- **状态管理**: Vuex 3.6.2

## 项目结构

```
frontend-vue2/
├── package.json          # 依赖配置
├── webpack.config.js     # 构建配置
├── index.html            # 入口 HTML
├── public/               # 静态资源
└── src/
    ├── main.js           # 应用入口
    ├── App.vue           # 根组件
    ├── api/
    │   └── index.js      # API 封装
    ├── utils/
    │   └── auth.js       # 认证工具
    ├── router/
    │   └── index.js      # 路由配置
    ├── components/       # 公共组件 (7个)
    │   ├── ActionMenu.vue
    │   ├── AiAnalysis.vue
    │   ├── CategoryTree.vue
    │   ├── FieldDiff.vue
    │   ├── MonacoEditor.vue
    │   ├── VersionHistory.vue
    │   └── VersionSelector.vue
    ├── views/            # 页面视图 (12个)
    │   ├── Login.vue
    │   ├── ChainList.vue
    │   ├── ChainEdit.vue (核心文件，约1200行)
    │   ├── ExecuteList.vue
    │   ├── ExecuteDetail.vue
    │   ├── AccountList.vue
    │   ├── DictCategory.vue
    │   ├── UserList.vue
    │   ├── ScheduledTask.vue
    │   ├── PluginDownload.vue
    │   └── SystemConfig.vue
    └── styles/           # 样式文件
        ├── design-tokens.css
        └── element-overrides.css
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览构建结果

```bash
npm run serve
```

## 转换说明

### 主要变更

1. **Vue 3 → Vue 2**: 使用 Composition API 转换为 Options API
2. **Element Plus → Element UI**: 组件 API 适配
3. **Vue Router 4 → Vue Router 3**: 路由配置调整
4. **Vite → Webpack**: 构建工具迁移

### 关键转换点

- `<script setup>` → `export default {}`
- `ref()` / `computed()` → `data()` / `computed`
- `onMounted()` → `mounted()`
- `useRoute()` / `useRouter()` → `this.$route` / `this.$router`
- `v-model="dialogVisible"` → `:visible.sync="dialogVisible"`
- `ElMessage` → `this.$message`

## 页面功能

- ✅ 登录页面
- ✅ 测试链路管理 (列表、编辑)
- ✅ 执行记录查询 (列表、详情)
- ✅ 测试账号管理
- ✅ 分类字典管理
- ✅ 用户管理 (管理员)
- ✅ 定时任务 (管理员)
- ✅ 浏览器插件下载
- ✅ 系统设置

## 注意事项

1. 所有 API 调用保持与后端接口一致
2. 路由守卫已适配 Vue Router 3
3. 组件引用使用 webpack 懒加载
4. 保持与原项目完全一致的功能和交互

## 开发规范

- 使用 Element UI 组件库
- 遵循 Vue 2 Options API 规范
- 保持组件化和模块化设计
- 所有页面保持响应式布局

---

**转换完成时间**: 2026-08-01
**源项目**: frontend (Vue 3)
**目标项目**: frontend-vue2 (Vue 2)
