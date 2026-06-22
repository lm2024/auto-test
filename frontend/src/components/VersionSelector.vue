<template>
  <div class="version-bar">
    <div class="version-bar-left">
      <span class="version-label">版本:</span>
      <el-select v-model="currentVersion" placeholder="选择版本" size="small" @change="onVersionChange" style="width: 200px">
        <el-option
          v-for="v in versions"
          :key="v.version"
          :label="'v' + v.version + ' — ' + formatTime(v.createTime)"
          :value="v.version"
        />
      </el-select>
      <el-button v-if="versions.length > 5" size="small" type="text" @click="loadAllVersions">
        查看全部 ({{ totalVersions }})
      </el-button>
    </div>
    <div class="version-bar-right" v-if="diffSummary">
      <span class="diff-badge added">
        <i class="el-icon-plus"></i>
        新增 {{ diffSummary.added }}
      </span>
      <span class="diff-badge removed">
        <i class="el-icon-minus"></i>
        删除 {{ diffSummary.removed }}
      </span>
      <span class="diff-badge modified">
        <i class="el-icon-edit"></i>
        修改 {{ diffSummary.modified }}
      </span>
      <span class="diff-badge unchanged">
        <i class="el-icon-check"></i>
        未变 {{ diffSummary.unchanged }}
      </span>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

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
      diffSummary: null,
      currentVersion: 0
    }
  },
  watch: {
    'currentVersion': {
      handler(v) {
        if (v) {
          this.currentVersion = v
        }
      },
      immediate: false
    }
  },
  mounted() {
    this.loadVersions()
  },
  methods: {
    formatTime(time) {
      if (!time) return ''
      const d = new Date(time)
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    },
    async loadVersions(all) {
      try {
        const params = { chainCode: this.chainCode, all: all ? 'true' : 'false' }
        const { data } = await axios.get('/api/chain/versions', { params })
        if (data.code === 200) {
          this.versions = data.data.list || []
          this.totalVersions = data.data.total || 0
          if (this.versions.length > 0 && !this.currentVersion) {
            this.currentVersion = this.versions[0].version
            this.onVersionChange(this.currentVersion)
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
        const { data } = await axios.get('/api/chain/version/diff', {
          params: { chainCode: this.chainCode, version }
        })
        if (data.code === 200) {
          this.diffSummary = data.data.summary
          this.$emit('diff-loaded', data.data)
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
