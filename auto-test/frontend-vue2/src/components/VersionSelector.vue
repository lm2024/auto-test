<template>
  <div class="version-bar">
    <div class="version-bar-left">
      <span class="version-label">版本:</span>
      <t-select v-model="currentVersion" placeholder="选择版本" size="small" style="width: 200px" @change="onVersionChange">
        <t-option
          v-for="v in versions"
          :key="v.version"
          :label="'v' + v.version + ' — ' + formatTime(v.createTime)"
          :value="v.version"
        />
      </t-select>
      <t-button v-if="versions.length > 5" size="small" variant="text" @click="loadAllVersions">
        查看全部 ({{ totalVersions }})
      </t-button>
    </div>
    <div class="version-bar-right" v-if="diffSummary">
      <span class="diff-badge added">
        <t-icon name="add" /> 新增 {{ diffSummary.added }}
      </span>
      <span class="diff-badge removed">
        <t-icon name="minus" /> 删除 {{ diffSummary.removed }}
      </span>
      <span class="diff-badge modified">
        <t-icon name="edit" /> 修改 {{ diffSummary.modified }}
      </span>
      <span class="diff-badge unchanged">
        <t-icon name="check" /> 未变 {{ diffSummary.unchanged }}
      </span>
    </div>
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'VersionSelector',
  props: {
    chainCode: { type: String, required: true },
    currentVersion: { type: Number, default: 0 }
  },
  data() {
    return {
      versions: [],
      totalVersions: 0,
      selectedVersion: this.currentVersion || 0,
      diffSummary: null,
      currentVersionData: this.currentVersion || 0
    }
  },
  mounted() {
    this.loadVersions()
  },
  watch: {
    currentVersion(val) {
      if (val) {
        this.currentVersionData = val
      }
    }
  },
  methods: {
    formatTime(time) {
      if (!time) return ''
      const d = new Date(time)
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    },
    async loadVersions(all) {
      all = all || false
      try {
        const params = { chainCode: this.chainCode, all: all ? 'true' : 'false' }
        const res = await api.get('/chain/versions', { params })
        if (res.code === 200) {
          this.versions = (res.data && res.data.list) || []
          this.totalVersions = (res.data && res.data.total) || 0
          if (this.versions.length > 0 && !this.currentVersionData) {
            this.currentVersionData = this.versions[0].version
            this.onVersionChange(this.currentVersionData)
          }
        }
      } catch (e) {
        console.error('加载版本列表失败:', e)
      }
    },
    loadAllVersions() {
      this.loadVersions(true)
    },
    async onVersionChange(version) {
      this.$emit('version-change', version)
      if (version <= 1) {
        this.diffSummary = null
        this.$emit('diff-loaded', null)
        return
      }
      try {
        const res = await api.get('/chain/version/diff', {
          params: { chainCode: this.chainCode, version }
        })
        if (res.code === 200) {
          this.diffSummary = res.data && res.data.summary
          this.$emit('diff-loaded', res.data)
        }
      } catch (e) {
        console.error('加载Diff失败:', e)
      }
    }
  }
}
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
