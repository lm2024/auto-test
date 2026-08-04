<template>
  <div class="version-bar">
    <div class="version-bar-left">
      <span class="version-label">版本:</span>
      <t-select v-model="currentVersion" placeholder="选择版本" size="small" @change="onVersionChange" style="width: 200px">
        <t-option
          v-for="v in versions"
          :key="v.version"
          :label="'v' + v.version + ' — ' + formatTime(v.createTime)"
          :value="v.version"
        />
      </t-select>
      <t-button v-if="versions.length > 5" size="small" theme="default" variant="text" @click="loadAllVersions">
        查看全部 ({{ totalVersions }})
      </t-button>
    </div>
    <div class="version-bar-right" v-if="diffSummary">
      <span class="diff-badge added">
        <AddIcon />
        新增 {{ diffSummary.added }}
      </span>
      <span class="diff-badge removed">
        <MinusIcon />
        删除 {{ diffSummary.removed }}
      </span>
      <span class="diff-badge modified">
        <EditIcon />
        修改 {{ diffSummary.modified }}
      </span>
      <span class="diff-badge unchanged">
        <CheckIcon />
        未变 {{ diffSummary.unchanged }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { AddIcon, MinusIcon, EditIcon, CheckIcon } from 'tdesign-icons-vue-next'
import axios from 'axios'

const props = defineProps({
  chainCode: { type: String, required: true },
  currentVersion: { type: Number, default: 0 }
})

const emit = defineEmits(['version-change', 'diff-loaded'])

const versions = ref([])
const totalVersions = ref(0)
const selectedVersion = ref(props.currentVersion || 0)
const diffSummary = ref(null)

const currentVersion = ref(props.currentVersion || 0)

function formatTime(time) {
  if (!time) return ''
  const d = new Date(time)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function loadVersions(all = false) {
  try {
    const params = { chainCode: props.chainCode, all: all ? 'true' : 'false' }
    const { data } = await axios.get('/api/chain/versions', { params })
    if (data.code === 200) {
      versions.value = data.data.list || []
      totalVersions.value = data.data.total || 0
      if (versions.value.length > 0 && !currentVersion.value) {
        currentVersion.value = versions.value[0].version
        onVersionChange(currentVersion.value)
      }
    }
  } catch (e) {
    console.error('加载版本列表失败:', e)
  }
}

function loadAllVersions() {
  loadVersions(true)
}

async function onVersionChange(version) {
  emit('version-change', version)
  if (version <= 1) {
    diffSummary.value = null
    emit('diff-loaded', null)
    return
  }
  try {
    const { data } = await axios.get('/api/chain/version/diff', {
      params: { chainCode: props.chainCode, version }
    })
    if (data.code === 200) {
      diffSummary.value = data.data.summary
      emit('diff-loaded', data.data)
    }
  } catch (e) {
    console.error('加载Diff失败:', e)
  }
}

watch(() => props.currentVersion, (v) => {
  if (v) {
    currentVersion.value = v
  }
})

onMounted(() => {
  loadVersions()
})

defineExpose({ loadVersions, currentVersion })
</script>

<style scoped>
.version-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(168, 85, 247, 0.04));
  border-bottom: 1px solid rgba(99, 102, 241, 0.1);
}
.version-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.version-label {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
}
.version-bar-right {
  display: flex;
  gap: 10px;
}
.diff-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}
.diff-badge.added {
  color: #16a34a;
  background: #f0fdf4;
}
.diff-badge.removed {
  color: #dc2626;
  background: #fef2f2;
}
.diff-badge.modified {
  color: #d97706;
  background: #fffbeb;
}
.diff-badge.unchanged {
  color: #6b7280;
  background: #f9fafb;
}
</style>
