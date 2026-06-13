<template>
  <div>
    <el-card>
      <template #header><span>系统设置</span></template>
      <el-form :model="config" label-width="120px" style="max-width:600px">
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
          <el-button type="primary" @click="saveConfig">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const config = ref({
  aiBaseUrl: 'http://localhost:11434/v1',
  aiApiKey: '',
  aiModel: 'qwen-max',
  aiTimeout: 120,
  idGenerateMode: 'AUTO_INCREMENT',
  idStep: 1
})

const saveConfig = () => {
  ElMessage.success('配置已保存（本地存储）')
  localStorage.setItem('autotest_config', JSON.stringify(config.value))
}
</script>
