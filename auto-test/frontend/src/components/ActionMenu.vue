<template>
  <t-dropdown trigger="click" :options="dropdownOptions" @click="onCommand">
    <t-button shape="circle" size="small" theme="default" variant="outline" class="action-trigger">
      <MoreIcon />
    </t-button>
  </t-dropdown>
</template>

<script setup>
import { computed, h } from 'vue'
import { MoreIcon } from 'tdesign-icons-vue-next'

// items: [{ label, command, icon?, divided?, danger?, disabled? }]
const props = defineProps({
  items: { type: Array, required: true }
})
const emit = defineEmits(['command'])

// t-dropdown 使用 options 数组描述菜单项；prefixIcon 需为 TNode，故把组件包成渲染函数
const dropdownOptions = computed(() =>
  props.items.map((item, idx) => ({
    content: item.label,
    value: item.command ?? idx,
    divider: !!item.divided,
    disabled: !!item.disabled,
    theme: item.danger ? 'error' : 'default',
    prefixIcon: item.icon ? () => h(item.icon) : undefined
  }))
)

// t-dropdown @click 回调签名为 (dropdownItem, context)
const onCommand = (option) => emit('command', option.value)
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

/* 危险操作项（如删除）用红色警示，全局一致
   t-dropdown 通过 theme="error" 标记，弹层挂载在 body 上，故此处用全局选择器 */
:global(.t-dropdown__item--theme-error) {
  color: var(--sb-danger);
}
:global(.t-dropdown__item--theme-error:hover) {
  background: var(--sb-danger-bg);
  color: var(--sb-danger);
}
</style>
