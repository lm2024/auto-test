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

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const API = 'http://localhost:8080/api/config'

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
    const res = await axios.get(`${API}/all`)
    const map = res.data.data || {}
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
    await axios.post(`${API}/save`, params)
    ElMessage.success('配置已保存')
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  } finally {
    saving.value = false
  }
}
</script>
