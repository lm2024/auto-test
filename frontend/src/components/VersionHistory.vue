<template>
  <div class="version-history">
    <div class="history-header">
      <span class="history-title">版本历史</span>
      <el-button size="small" text @click="loadVersions(true)" v-if="versions.length >= 5">
        加载全部
      </el-button>
    </div>
    <div class="history-list">
      <div v-for="v in versions" :key="v.version"
           class="history-item"
           :class="{ active: selectedVersion === v.version }"
           @click="$emit('select-version', v.version)">
        <div class="history-version">v{{ v.version }}</div>
        <div class="history-info">
          <div class="history-time">{{ formatTime(v.createTime) }}</div>
          <div class="history-meta" v-if="v.nodeCount">{{ v.nodeCount }} 个接口</div>
        </div>
        <div class="history-diff" v-if="v.diffSummary">
          <span v-if="v.diffSummary.added" class="diff-a">+{{ v.diffSummary.added }}</span>
          <span v-if="v.diffSummary.removed" class="diff-r">-{{ v.diffSummary.removed }}</span>
          <span v-if="v.diffSummary.modified" class="diff-m">~{{ v.diffSummary.modified }}</span>
        </div>
      </div>
      <div v-if="versions.length === 0" class="history-empty">暂无版本记录</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  chainCode: { type: String, required: true },
  selectedVersion: { type: Number, default: 0 }
})

defineEmits(['select-version'])

const versions = ref([])

function formatTime(time) {
  if (!time) return ''
  const d = new Date(time)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function loadVersions(all = false) {
  try {
    const { data } = await axios.get('/api/chain/versions', {
      params: { chainCode: props.chainCode, all: all ? 'true' : 'false' }
    })
    if (data.code === 200) {
      versions.value = data.data.list || []
    }
  } catch (e) {
    console.error('加载版本历史失败:', e)
  }
}

onMounted(() => {
  loadVersions()
})

defineExpose({ loadVersions })
</script>

<style scoped>
.version-history {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}
.history-header {
  padding: 10px 14px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.history-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.history-list {
  max-height: 200px;
  overflow-y: auto;
}
.history-item {
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid #f3f4f6;
}
.history-item:last-child {
  border-bottom: none;
}
.history-item:hover {
  background: #f9fafb;
}
.history-item.active {
  background: rgba(99, 102, 241, 0.06);
  border-left: 3px solid #6366f1;
}
.history-version {
  font-size: 13px;
  font-weight: 700;
  color: #6366f1;
  min-width: 36px;
}
.history-info {
  flex: 1;
}
.history-time {
  font-size: 12px;
  color: #6b7280;
}
.history-meta {
  font-size: 11px;
  color: #9ca3af;
}
.history-diff {
  display: flex;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
}
.diff-a { color: #16a34a; }
.diff-r { color: #dc2626; }
.diff-m { color: #d97706; }
.history-empty {
  padding: 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
