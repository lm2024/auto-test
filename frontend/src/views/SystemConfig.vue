<template>
  <div>
    <el-card>
      <template #header><span>系统设置</span></template>
      <el-form :model="config" label-width="120px" style="max-width:600px" v-loading="loading">
        <el-divider content-position="left">大模型配置</el-divider>
        <el-form-item label="服务地址">
          <el-input v-model="config.aiBaseUrl" placeholder="http://localhost:11434/v1" />
        </el-form-item>
        <el-form-item label="API密钥">
          <el-input v-model="config.aiApiKey" type="password" show-password />
        </el-form-item>
        <el-form-item label="模型名称">
          <el-input v-model="config.aiModel" placeholder="qwen-max" />
        </el-form-item>
        <el-form-item label="超时时间(秒)">
          <el-input-number v-model="config.aiTimeout" :min="30" :max="300" />
        </el-form-item>

        <el-divider content-position="left">ID生成默认规则</el-divider>
        <el-form-item label="默认模式">
          <el-select v-model="config.idGenerateMode">
            <el-option label="自增模式" value="AUTO_INCREMENT" />
            <el-option label="自定义模式" value="CUSTOM" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认步长">
          <el-input-number v-model="config.idStep" :min="1" :max="20" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveConfig" :loading="saving">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { Message } from 'element-ui'
import api from '../api/index.js'

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
  mounted() {
    this.loadConfig()
  },
  methods: {
    async loadConfig() {
      this.loading = true
      try {
        const res = await api.get('/config/all')
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
        await api.post('/config/save', params)
        Message.success('配置已保存')
      } catch (e) {
        Message.error('保存失败: ' + (e.response && e.response.data && e.response.data.message || e.message))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

/* ── Card ── */
::v-deep .el-card {
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(99, 102, 241, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.08);
}

::v-deep .el-card__header {
  padding: 20px 28px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(129, 140, 248, 0.02));
}

::v-deep .el-card__header span {
  font-size: 18px;
  font-weight: 700;
  color: #1e1b4b;
}

/* ── Form ── */
::v-deep .el-divider__text {
  font-weight: 600;
  font-size: 15px;
  color: #4338ca;
  display: flex;
  align-items: center;
  gap: 8px;
}

::v-deep .el-form-item__label {
  font-weight: 500;
  color: #4338ca;
  font-size: 14px;
}

::v-deep .el-input__inner {
  border-radius: 10px;
  background: #fff;
  border: 1px solid #d0d5dd;
  box-shadow: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

::v-deep .el-input__inner:hover {
  border-color: #a5b4fc;
  box-shadow: none;
}

::v-deep .el-input__inner:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  border-color: #6366f1;
}

/* ── Buttons ── */
::v-deep .el-button--primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  padding: 10px 28px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

::v-deep .el-button--primary:hover {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45);
  transform: translateY(-1px);
}
</style>
