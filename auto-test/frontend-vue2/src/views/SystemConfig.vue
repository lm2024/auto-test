<template>
  <div>
    <t-card>
      <template #title><span>系统设置</span></template>
      <t-form :data="config" label-width="120px" style="max-width:600px" :loading="loading">
        <t-divider content-position="left">大模型配置</t-divider>
        <t-form-item label="服务地址">
          <t-input v-model="config.aiBaseUrl" placeholder="http://localhost:11434/v1" />
        </t-form-item>
        <t-form-item label="API密钥">
          <t-input v-model="config.aiApiKey" type="password" />
        </t-form-item>
        <t-form-item label="模型名称">
          <t-input v-model="config.aiModel" placeholder="qwen-max" />
        </t-form-item>
        <t-form-item label="超时时间(秒)">
          <t-input-number v-model="config.aiTimeout" :min="30" :max="300" />
        </t-form-item>

        <t-divider content-position="left">ID生成默认规则</t-divider>
        <t-form-item label="默认模式">
          <t-select v-model="config.idGenerateMode">
            <t-option label="自增模式" value="AUTO_INCREMENT" />
            <t-option label="自定义模式" value="CUSTOM" />
          </t-select>
        </t-form-item>
        <t-form-item label="默认步长">
          <t-input-number v-model="config.idStep" :min="1" :max="20" />
        </t-form-item>

        <t-form-item>
          <t-button theme="primary" @click="saveConfig" :loading="saving">保存</t-button>
        </t-form-item>
      </t-form>
    </t-card>
  </div>
</template>

<script>
import api from '../api/index.js'

const API = '/config'

export default {
  name: 'SystemConfig',
  data() {
    return {
      loading: false,
      saving: false,
      config: {
        aiBaseUrl: 'http://localhost:11434/v1',
        aiApiKey: '',
        aiModel: 'qwen-max',
        aiTimeout: 120,
        idGenerateMode: 'AUTO_INCREMENT',
        idStep: 1
      }
    }
  },
  created() {
    this.loadConfig()
  },
  methods: {
    async loadConfig() {
      this.loading = true
      try {
        const res = await api.get(`${API}/all`)
        const map = res.data || {}
        if (map['ai.baseUrl']) this.config.aiBaseUrl = map['ai.baseUrl']
        if (map['ai.apiKey']) this.config.aiApiKey = map['ai.apiKey']
        if (map['ai.model']) this.config.aiModel = map['ai.model']
        if (map['ai.timeout']) this.config.aiTimeout = parseInt(map['ai.timeout']) || 120
        if (map['idGenerate.mode']) this.config.idGenerateMode = map['idGenerate.mode']
        if (map['idGenerate.step']) this.config.idStep = parseInt(map['idGenerate.step']) || 1
      } catch (e) {
        console.warn('Failed to load config from backend, using defaults', e)
      } finally {
        this.loading = false
      }
    },
    async saveConfig() {
      this.saving = true
      try {
        const params = {
          'ai.baseUrl': this.config.aiBaseUrl || '',
          'ai.apiKey': this.config.aiApiKey || '',
          'ai.model': this.config.aiModel || '',
          'ai.timeout': String(this.config.aiTimeout || 120),
          'idGenerate.mode': this.config.idGenerateMode || 'AUTO_INCREMENT',
          'idGenerate.step': String(this.config.idStep || 1)
        }
        await api.post(`${API}/save`, params)
        this.$message.success('配置已保存')
      } catch (e) {
        this.$message.error('保存失败: ' + (e.response && e.response.data && e.response.data.message ? e.response.data.message : e.message))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>

/* ── Card ── */
::v-deep(.t-card) {
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(62, 207, 142, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(62, 207, 142, 0.08);
}

::v-deep(.t-card__header) {
  padding: 20px 28px;
  border-bottom: 1px solid rgba(62, 207, 142, 0.08);
  background: linear-gradient(135deg, rgba(62, 207, 142, 0.04), rgba(74, 222, 128, 0.02));
}

::v-deep(.t-card__header .t-card__body > p) {
  font-size: 18px;
  font-weight: 700;
  color: var(--sb-text);
  margin: 0;
}

/* ── Form ── */
::v-deep(.t-form) {
  max-width: 680px;
}

::v-deep(.t-divider__inner-text) {
  font-weight: 600;
  font-size: 15px;
  color: var(--sb-green-deep);
  display: flex;
  align-items: center;
  gap: 8px;
}

::v-deep(.t-form__label) {
  font-weight: 500;
  color: var(--sb-green-deep);
  font-size: 14px;
}

::v-deep(.t-input),
::v-deep(.t-select),
::v-deep(.t-input-number) {
  border-radius: 10px;
  background: var(--sb-surface);
  border: 1px solid var(--sb-border-strong);
  box-shadow: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

::v-deep(.t-input:hover),
::v-deep(.t-select:hover) {
  border-color: var(--sb-accent-soft-2);
  box-shadow: none;
}

::v-deep(.t-input--focused) {
  box-shadow: 0 0 0 2px rgba(62, 207, 142, 0.15);
  border-color: var(--sb-green);
}

/* ── Buttons ── */
::v-deep(.t-button--theme-primary) {
  background: linear-gradient(135deg, var(--sb-green), var(--sb-green-soft));
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  padding: 10px 28px;
  box-shadow: 0 2px 8px rgba(62, 207, 142, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

::v-deep(.t-button--theme-primary:hover) {
  box-shadow: 0 4px 16px rgba(62, 207, 142, 0.45);
  transform: translateY(-1px);
}
</style>
