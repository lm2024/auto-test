# 项目记忆

## 前端技术栈迁移 (2026-06-22)

前端已从 Vue 3 + Vite 完全迁移到 Vue 2.6 + Vue CLI + Webpack，版本与公司项目一致：

- **Vue**: 2.6.12
- **Vue Router**: 3.0.2
- **Vuex**: 3.1.0
- **Axios**: 0.18.1
- **Element UI**: 2.13.2
- **@vue/composition-api**: 1.7.2 (用于 router/compat.js 兼容层)
- **@vue/cli-service**: ~3.12.0
- **@vue/cli-plugin-babel**: ~3.12.0
- **vue-template-compiler**: 2.6.12
- **sass**: ~1.32.6
- **sass-loader**: ^8.0.0

### 架构变更

- 所有 `.vue` 文件从 `<script setup>` + Composition API 转为 Options API (`data()`, `computed`, `methods`, `mounted()`)
- 移除了 Vite (`vite.config.js` 已删除)
- 添加了 Vue CLI 配置 (`vue.config.js`, `babel.config.js`, `public/index.html`)
- 模板中可选链 `?.` 全部替换为 `&&` 短路判断（Vue 2.6 模板编译器不支持可选链）
- `start-frontend.bat` 使用 `npm run dev` -> `vue-cli-service serve`
- 构建命令: `npm run build` -> `vue-cli-service build`

### 注意事项

- Vue 2.6 不支持 `<script setup>`, `defineProps`, `defineEmits`, `defineExpose`
- `@vue/composition-api` 仅在 `main.js` 和 `router/compat.js` 中使用
- Babel preset 使用 `@vue/babel-preset-app` 而非 `@vue/cli-plugin-babel/preset`
- 不要重新引入 Vite 或 Vue 3 特性
