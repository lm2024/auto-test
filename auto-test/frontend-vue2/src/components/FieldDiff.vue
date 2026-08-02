<template>
  <div class="field-diff">
    <div v-if="!changes || changes.length === 0" class="no-changes">
      <i class="el-icon-check" />
      无字段变化
    </div>
    <div v-for="change in changes" :key="change.field" class="diff-item">
      <div class="diff-label">{{ change.label }}</div>
      <div class="diff-values">
        <div class="diff-old" v-if="change.oldValue !== undefined">
          <span class="diff-tag old">旧值</span>
          <pre class="diff-pre">{{ formatValue(change.oldValue) }}</pre>
        </div>
        <div class="diff-new" v-if="change.newValue !== undefined">
          <span class="diff-tag new">新值</span>
          <pre class="diff-pre">{{ formatValue(change.newValue) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FieldDiff',
  props: {
    changes: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    formatValue(val) {
      if (val === null || val === undefined) return '(空)'
      if (typeof val === 'string') {
        try {
          return JSON.stringify(JSON.parse(val), null, 2)
        } catch (e) {
          return val
        }
      }
      return JSON.stringify(val, null, 2)
    }
  }
}
</script>

<style scoped>
.field-diff {
  padding: 8px 0;
}
.no-changes {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 13px;
  padding: 12px;
}
.diff-item {
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.diff-label {
  padding: 6px 12px;
  background: #f9fafb;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}
.diff-values {
  display: flex;
  flex-direction: column;
}
.diff-old, .diff-new {
  padding: 8px 12px;
  position: relative;
}
.diff-old {
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
}
.diff-new {
  background: #f0fdf4;
}
.diff-tag {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}
.diff-tag.old {
  color: #dc2626;
  background: #fee2e2;
}
.diff-tag.new {
  color: #16a34a;
  background: #dcfce7;
}
.diff-pre {
  margin: 0;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  color: #374151;
  line-height: 1.5;
}
</style>
