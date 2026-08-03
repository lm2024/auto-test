<template>
  <el-dropdown trigger="click" @command="onCommand">
    <el-button :icon="MoreFilled" circle size="small" class="action-trigger" />
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="(item, idx) in items"
          :key="idx"
          :command="item.command"
          :icon="item.icon"
          :divided="!!item.divided"
          :disabled="!!item.disabled"
          :class="{ 'is-danger': item.danger }"
        >{{ item.label }}</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { MoreFilled } from '@element-plus/icons-vue'

// items: [{ label, command, icon?, divided?, danger?, disabled? }]
defineProps({
  items: { type: Array, required: true }
})
const emit = defineEmits(['command'])

const onCommand = (command) => emit('command', command)
</script>

<style scoped>
/* 统一的「三个点」触发器：默认中性灰，hover 时点亮 emerald */
.action-trigger {
  color: var(--text-mute);
  border-color: var(--sb-border);
  background: transparent;
  transition: color .18s ease, border-color .18s ease, background-color .18s ease;
}
.action-trigger:hover,
.action-trigger:focus {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--sb-accent-bg);
}

/* 危险操作项（如删除）用红色警示，全局一致 */
:deep(.el-dropdown-menu__item.is-danger) {
  color: var(--sb-danger);
}
:deep(.el-dropdown-menu__item.is-danger:hover) {
  background: var(--sb-danger-bg);
  color: var(--sb-danger);
}
</style>
