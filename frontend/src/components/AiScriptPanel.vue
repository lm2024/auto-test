<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>AI 生成脚本</span>
        <el-tag size="small" type="success">Experimental</el-tag>
      </div>
    </template>

    <el-form label-position="top">
      <el-form-item label="用自然语言描述测试场景">
        <el-input
          v-model="prompt"
          type="textarea"
          :rows="4"
          placeholder='例如: 打开百度首页，搜索「天气预报」，截图搜索结果页'
        />
      </el-form-item>

      <el-form-item label="起始URL（可选）">
        <el-input v-model="targetUrl" placeholder="https://..." />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="doGenerate" :loading="generating" style="width:100%">
          {{ generating ? '正在生成...' : '生成脚本' }}
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 生成结果预览 -->
    <div v-if="result.length > 0" style="margin-top:10px">
      <div class="result-header">
        <span>生成结果 ({{ result.length }} 步)</span>
        <div>
          <el-button size="small" type="success" @click="$emit('apply', result)">应用到步骤列表</el-button>
          <el-button size="small" @click="result = []">清除</el-button>
        </div>
      </div>
      <div v-for="(act, idx) in result" :key="idx" class="result-step">
        <div class="step-num">{{ idx + 1 }}</div>
        <div class="step-info">
          <el-tag :type="typeColor(act.actionType)" size="small" style="width:70px;text-align:center">
            {{ act.actionType }}
          </el-tag>
          <span class="step-desc">{{ act.description || '-' }}</span>
        </div>
        <div class="step-detail" v-if="act.targetSelector || act.targetUrl || act.value">
          <span v-if="act.targetSelector" class="step-meta">选择器: {{ act.targetSelector }}</span>
          <span v-if="act.targetUrl" class="step-meta">URL: {{ act.targetUrl }}</span>
          <span v-if="act.value" class="step-meta">值: {{ act.value }}</span>
        </div>
      </div>
    </div>

    <el-alert v-if="error" type="error" :description="error" show-icon closable style="margin-top:10px" />
  </el-card>
</template>

<script>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { browserApi } from '../api/browser'

export default {
  name: 'AiScriptPanel',
  emits: ['apply'],
  setup(props, { emit }) {
    const prompt = ref('')
    const targetUrl = ref('')
    const generating = ref(false)
    const result = ref([])
    const error = ref('')

    function typeColor(type) {
      const colors = { navigate: '', click: 'success', input: 'warning', wait: 'info', assert: 'danger' }
      return colors[type] || ''
    }

    async function doGenerate() {
      if (!prompt.value.trim()) {
        ElMessage.warning('请输入测试场景描述')
        return
      }

      generating.value = true
      error.value = ''
      result.value = []

      try {
        const res = await browserApi.aiGenerateScript(prompt.value, targetUrl.value)
        if (res.data && res.data.length > 0) {
          result.value = res.data
          ElMessage.success('生成成功，共 ' + res.data.length + ' 步')
        } else {
          ElMessage.warning('AI 返回为空，请重试或检查 AI 服务')
          error.value = 'AI 未返回有效脚本'
        }
      } catch (e) {
        ElMessage.error('生成失败: ' + (e.message || ''))
        error.value = e.message || 'AI 服务调用失败'
      } finally {
        generating.value = false
      }
    }

    return { prompt, targetUrl, generating, result, error, typeColor, doGenerate }
  }
}
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: bold; }
.result-step { padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
.step-num { display: inline-block; width: 22px; height: 22px; border-radius: 50%;
  background: #409eff; color: #fff; text-align: center; line-height: 22px; font-size: 12px;
  margin-right: 8px; flex-shrink: 0; }
.step-info { display: flex; align-items: center; gap: 8px; }
.step-desc { font-size: 13px; }
.step-detail { margin-left: 80px; font-size: 12px; color: #999; }
.step-meta { margin-right: 12px; }
</style>
