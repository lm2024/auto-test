<template>
  <t-dropdown trigger="click" :min-column-width="120">
    <t-button variant="text" shape="circle" class="action-trigger">
      <MoreIcon />
    </t-button>
    <t-dropdown-menu>
      <t-dropdown-item
        v-for="(item, idx) in items"
        :key="idx"
        :value="item.command"
        :disabled="!!item.disabled"
        :class="{ 'is-danger': item.danger }"
        @click="onCommand"
      >{{ item.label }}</t-dropdown-item>
    </t-dropdown-menu>
  </t-dropdown>
</template>

<script>
import { MoreIcon } from 'tdesign-icons-vue'

export default {
  name: 'ActionMenu',
  components: { MoreIcon },
  props: {
    items: {
      type: Array,
      required: true
    }
  },
  methods: {
    onCommand(value) {
      this.$emit('command', value)
    }
  }
}
</script>

<style scoped>
/* 统一的「三个点」触发器：默认中性灰，hover 时点亮 emerald */
.action-trigger {
  color: var(--sb-text-mute, #71717a);
  transition: color .18s ease, background-color .18s ease;
}
.action-trigger:hover,
.action-trigger:focus {
  color: var(--sb-green, #3ecf8e);
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.08));
}

/* 危险操作项（如删除）用红色警示，全局一致 */
::v-deep .t-dropdown-menu__item.is-danger {
  color: var(--sb-danger, #ef4444);
}
::v-deep .t-dropdown-menu__item.is-danger:hover {
  background: var(--sb-danger-bg, rgba(239, 68, 68, 0.12));
  color: var(--sb-danger, #ef4444);
}
</style>
