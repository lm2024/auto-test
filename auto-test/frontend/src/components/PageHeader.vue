<template>
  <div class="page-header">
    <div class="page-heading">
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  min-height: 52px;
}
.page-heading { min-width: 0; }
.page-heading h1 {
  margin: 0;
  color: var(--text);
  font-size: 22px;
  line-height: 32px;
  font-weight: 700;
}
.page-heading p {
  margin: 4px 0 0;
  color: var(--text-secondary, #7b8794);
  font-size: 13px;
  line-height: 20px;
}
.page-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}
@media (max-width: 640px) {
  .page-header { align-items: stretch; flex-direction: column; gap: 12px; }
  .page-actions { padding-top: 0; }
}
</style>
