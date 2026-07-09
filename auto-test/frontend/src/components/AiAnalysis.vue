<template>
  <div class="ai-analysis" v-if="analysis">
    <div class="ai-header">
      <el-icon><MagicStick /></el-icon>
      <span>AI 差异分析</span>
    </div>
    <div class="ai-body">
      <div class="ai-summary" v-if="analysis.summary">
        <div class="ai-section-title">变更摘要</div>
        <div class="ai-text">{{ analysis.summary }}</div>
      </div>
      <div class="ai-section" v-if="analysis.impacts && analysis.impacts.length">
        <div class="ai-section-title">潜在影响</div>
        <ul class="ai-list">
          <li v-for="(impact, i) in analysis.impacts" :key="i" class="ai-list-item impact">{{ impact }}</li>
        </ul>
      </div>
      <div class="ai-section" v-if="analysis.suggestions && analysis.suggestions.length">
        <div class="ai-section-title">测试建议</div>
        <ul class="ai-list">
          <li v-for="(sug, i) in analysis.suggestions" :key="i" class="ai-list-item suggestion">{{ sug }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { MagicStick } from '@element-plus/icons-vue'

const props = defineProps({
  analysis: { type: Object, default: null }
})
</script>

<style scoped>
.ai-analysis {
  border: 1px solid #c4b5fd;
  border-radius: 10px;
  overflow: hidden;
  margin-top: 12px;
}
.ai-header {
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(168, 85, 247, 0.08));
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #7c3aed;
  border-bottom: 1px solid rgba(139, 92, 246, 0.15);
}
.ai-body {
  padding: 14px;
}
.ai-summary {
  margin-bottom: 12px;
}
.ai-section {
  margin-bottom: 12px;
}
.ai-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 6px;
}
.ai-text {
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
}
.ai-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ai-list-item {
  font-size: 12px;
  color: #374151;
  padding: 6px 10px;
  margin-bottom: 4px;
  border-radius: 6px;
  line-height: 1.5;
}
.ai-list-item.impact {
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
}
.ai-list-item.suggestion {
  background: #f0fdf4;
  border-left: 3px solid #22c55e;
}
</style>
