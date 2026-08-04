<template>
  <div>
    <t-card>
      <template #header><span>系统设置</span></template>
      <t-loading :loading="loading">
        <t-form :data="config" label-width="120px" style="max-width:600px">
          <t-divider align="left">大模型配置</t-divider>
          <t-form-item label="服务地址" name="aiBaseUrl">
            <t-input v-model="config.aiBaseUrl" placeholder="http://localhost:11434/v1" />
          </t-form-item>
          <t-form-item label="API密钥" name="aiApiKey">
            <t-input v-model="config.aiApiKey" type="password" />
          </t-form-item>
          <t-form-item label="模型名称" name="aiModel">
            <t-input v-model="config.aiModel" placeholder="qwen-max" />
          </t-form-item>
          <t-form-item label="超时时间(秒)" name="aiTimeout">
            <t-input-number v-model="config.aiTimeout" :min="30" :max="300" />
          </t-form-item>

          <t-divider align="left">ID生成默认规则</t-divider>
          <t-form-item label="默认模式" name="idGenerateMode">
            <t-select v-model="config.idGenerateMode">
              <t-option label="自增模式" value="AUTO_INCREMENT" />
              <t-option label="自定义模式" value="CUSTOM" />
            </t-select>
          </t-form-item>
          <t-form-item label="默认步长" name="idStep">
            <t-input-number v-model="config.idStep" :min="1" :max="20" />
          </t-form-item>

          <t-form-item>
            <t-button theme="primary" @click="saveConfig" :loading="saving">保存</t-button>
          </t-form-item>
        </t-form>
      </t-loading>
    </t-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import api from '../api/index.js'

const API = '/config'

const loading = ref(false)
const saving = ref(false)

const config = ref({
  aiBaseUrl: 'http://localhost:11434/v1',
  aiApiKey: '',
  aiModel: 'qwen-max',
  aiTimeout: 120,
  idGenerateMode: 'AUTO_INCREMENT',
  idStep: 1
})

onMounted(() => {
  loadConfig()
})

const loadConfig = async () => {
  loading.value = true
  try {
    const res = await api.get(`${API}/all`)
    const map = res.data || {}
    if (map['ai.baseUrl']) config.value.aiBaseUrl = map['ai.baseUrl']
    if (map['ai.apiKey']) config.value.aiApiKey = map['ai.apiKey']
    if (map['ai.model']) config.value.aiModel = map['ai.model']
    if (map['ai.timeout']) config.value.aiTimeout = parseInt(map['ai.timeout']) || 120
    if (map['idGenerate.mode']) config.value.idGenerateMode = map['idGenerate.mode']
    if (map['idGenerate.step']) config.value.idStep = parseInt(map['idGenerate.step']) || 1
  } catch (e) {
    console.warn('Failed to load config from backend, using defaults', e)
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    const params = {
      'ai.baseUrl': config.value.aiBaseUrl || '',
      'ai.apiKey': config.value.aiApiKey || '',
      'ai.model': config.value.aiModel || '',
      'ai.timeout': String(config.value.aiTimeout || 120),
      'idGenerate.mode': config.value.idGenerateMode || 'AUTO_INCREMENT',
      'idGenerate.step': String(config.value.idStep || 1)
    }
    await api.post(`${API}/save`, params)
    MessagePlugin.success('配置已保存')
  } catch (e) {
    MessagePlugin.error('保存失败: ' + (e.response?.data?.message || e.message))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>

/* ── Card ── */
:deep(.el-card) {
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(62, 207, 142, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(62, 207, 142, 0.08);
}

:deep(.el-card__header) {
  padding: 20px 28px;
  border-bottom: 1px solid rgba(62, 207, 142, 0.08);
  background: linear-gradient(135deg, rgba(62, 207, 142, 0.04), rgba(74, 222, 128, 0.02));
}

:deep(.el-card__header .el-card__body > p) {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

/* ── Form ── */
:deep(.el-form) {
  max-width: 680px;
}

:deep(.el-divider__text) {
  font-weight: 600;
  font-size: 15px;
  color: var(--primary-deep);
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--primary-deep);
  font-size: 14px;
}

:deep(.el-input__wrapper),
:deep(.el-select .el-input__wrapper),
:deep(.el-input-number) {
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--sb-border-strong);
  box-shadow: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

:deep(.el-input__wrapper:hover),
:deep(.el-select .el-input__wrapper:hover) {
  border-color: var(--sb-accent-soft-2);
  box-shadow: none;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(62, 207, 142, 0.15);
  border-color: var(--primary);
}

/* ── Buttons ── */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--primary), var(--primary-soft));
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  padding: 10px 28px;
  box-shadow: 0 2px 8px rgba(62, 207, 142, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.el-button--primary:hover) {
  box-shadow: 0 4px 16px rgba(62, 207, 142, 0.45);
  transform: translateY(-1px);
}
</style>
