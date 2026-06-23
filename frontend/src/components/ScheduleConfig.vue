<template>
  <el-dialog v-model="visible" title="定时配置" width="500px">
    <el-form :model="form" label-width="100px">
      <el-form-item label="Cron 表达式">
        <el-input v-model="form.cronExpression" placeholder="0 0 8 * * ?  (每天早上8点)" />
      </el-form-item>
      <el-form-item label="调度名称">
        <el-input v-model="form.scheduleName" placeholder="如: 每日回归" />
      </el-form-item>
      <el-form-item>
        <div style="font-size:12px;color:#999">
          Cron 格式: 秒 分 时 日 月 周<br/>
          常用示例: <br/>
          每天早上8点: 0 0 8 * * ? <br/>
          每小时: 0 0 * * * ? <br/>
          每30分钟: 0 */30 * * * ? <br/>
          周一至周五早9点: 0 0 9 * * MON-FRI
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button v-if="hasSchedule" type="danger" @click="cancelSchedule">取消定时</el-button>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" @click="saveSchedule" :loading="saving">保存</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { browserApi } from '../api/browser'

export default {
  name: 'ScheduleConfig',
  props: {
    modelValue: Boolean,
    taskCode: String
  },
  emits: ['update:modelValue', 'saved'],
  setup(props, { emit }) {
    const visible = ref(false)
    const saving = ref(false)
    const hasSchedule = ref(false)
    const form = ref({ cronExpression: '0 0 8 * * ?', scheduleName: '' })

    watch(() => props.modelValue, (val) => {
      visible.value = val
      if (val && props.taskCode) {
        loadSchedule()
      }
    })

    watch(visible, (val) => {
      emit('update:modelValue', val)
    })

    async function loadSchedule() {
      try {
        const res = await browserApi.getSchedule(props.taskCode)
        if (res.data) {
          hasSchedule.value = true
          form.value.cronExpression = res.data.cronExpression || '0 0 8 * * ?'
          form.value.scheduleName = res.data.scheduleName || ''
        } else {
          hasSchedule.value = false
        }
      } catch (e) {
        hasSchedule.value = false
      }
    }

    async function saveSchedule() {
      if (!form.value.cronExpression.trim()) {
        ElMessage.warning('请输入 Cron 表达式')
        return
      }
      saving.value = true
      try {
        await browserApi.createSchedule(props.taskCode, form.value.cronExpression, form.value.scheduleName)
        ElMessage.success('定时配置已保存')
        emit('saved')
        visible.value = false
      } catch (e) {
        ElMessage.error('保存失败: ' + (e.message || ''))
      } finally {
        saving.value = false
      }
    }

    async function cancelSchedule() {
      try {
        await browserApi.cancelSchedule(props.taskCode)
        ElMessage.success('已取消定时')
        hasSchedule.value = false
        emit('saved')
        visible.value = false
      } catch (e) {
        ElMessage.error('取消失败')
      }
    }

    return { visible, saving, hasSchedule, form, saveSchedule, cancelSchedule }
  }
}
</script>
