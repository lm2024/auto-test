<template>
  <div class="browser-task-editor">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="$router.back()" :icon="ArrowLeft">返回</el-button>
        <h2>{{ task.taskName || '浏览器任务编辑器' }}</h2>
      </div>
      <div class="header-right">
        <el-button @click="openAiPanel" :icon="MagicStick">AI 生成步骤</el-button>
        <el-button type="success" @click="saveSteps" :loading="saving">保存步骤</el-button>
        <el-button type="primary" @click="runTask" :loading="executing" :icon="VideoPlay">执行</el-button>
      </div>
    </div>

    <div class="task-info-bar">
      <span><strong>任务编码：</strong>{{ task.taskCode }}</span>
      <span><strong>目标URL：</strong>{{ task.targetUrl || '未设置' }}</span>
      <span><strong>步骤数：</strong>{{ steps.length }}</span>
    </div>

    <div class="editor-body">
      <div class="steps-panel">
        <div class="panel-header">
          <span>操作步骤</span>
          <el-button size="small" @click="addStep" :icon="Plus">添加步骤</el-button>
        </div>

        <div v-if="steps.length === 0" class="empty-steps">
          <el-icon :size="40"><List /></el-icon>
          <p>暂无步骤，点击"添加步骤"或"AI 生成步骤"开始</p>
        </div>

        <draggable v-else v-model="steps" item-key="stepIndex" handle=".drag-handle" @end="onDragEnd" animation="200">
          <template #item="{ element, index }">
            <div class="step-card" :class="{ 'is-editing': editingIndex === index }">
              <div class="step-header">
                <el-icon class="drag-handle" :size="16"><Rank /></el-icon>
                <span class="step-number">#{{ index + 1 }}</span>
                <el-select v-model="element.actionType" size="small" style="width:130px" @change="onActionTypeChange(element)">
                  <el-option label="navigate 导航" value="navigate" />
                  <el-option label="click 点击" value="click" />
                  <el-option label="input 输入" value="input" />
                  <el-option label="select 选择" value="select" />
                  <el-option label="check 勾选" value="check" />
                  <el-option label="submit 提交" value="submit" />
                  <el-option label="keypress 按键" value="keypress" />
                  <el-option label="wait 等待" value="wait" />
                  <el-option label="screenshot 截图" value="screenshot" />
                  <el-option label="assert 断言" value="assert" />
                  <el-option label="evaluate 执行JS" value="evaluate" />
                </el-select>
                <el-input v-model="element.actionName" size="small" placeholder="步骤名称" style="width:160px" />
                <div class="step-actions">
                  <el-switch v-model="element.continueOnFail" size="small" active-text="失败继续" style="--el-switch-on-color:#6366f1" />
                  <el-button link type="danger" size="small" @click="removeStep(index)">删除</el-button>
                </div>
              </div>
              <div class="step-body" v-show="editingIndex === index || true">
                <el-row :gutter="12">
                  <el-col :span="12" v-if="['navigate','click','input'].includes(element.actionType)">
                    <div class="field-label">目标 URL</div>
                    <el-input v-model="element.targetUrl" size="small" placeholder="https://..." />
                  </el-col>
                  <el-col :span="12" v-if="!['navigate','wait','screenshot','evaluate'].includes(element.actionType)">
                    <div class="field-label">选择器 (CSS)</div>
                    <el-input v-model="element.targetSelector" size="small" placeholder="#login-btn / .submit" />
                  </el-col>
                  <el-col :span="12" v-if="['input','select','keypress','evaluate'].includes(element.actionType)">
                    <div class="field-label">{{ element.actionType === 'input' ? '输入值' : element.actionType === 'select' ? '选项值' : element.actionType === 'keypress' ? '按键' : 'JS代码' }}</div>
                    <el-input v-model="element.value" size="small" :placeholder="element.actionType === 'evaluate' ? 'document.title' : '值'" />
                  </el-col>
                  <el-col :span="6" v-if="element.actionType === 'wait'">
                    <div class="field-label">等待毫秒</div>
                    <el-input-number v-model="element.waitDelayMs" size="small" :min="0" :max="60000" style="width:100%" />
                  </el-col>
                  <el-col :span="6">
                    <div class="field-label">超时毫秒</div>
                    <el-input-number v-model="element.timeoutMs" size="small" :min="1000" :max="120000" :step="1000" style="width:100%" />
                  </el-col>
                  <el-col :span="6" v-if="element.actionType === 'assert'">
                    <div class="field-label">断言类型</div>
                    <el-select v-model="element.assertType" size="small" style="width:100%">
                      <el-option label="visible 可见" value="visible" />
                      <el-option label="notVisible 不可见" value="notVisible" />
                      <el-option label="exists 存在" value="exists" />
                      <el-option label="notExists 不存在" value="notExists" />
                      <el-option label="text 文本包含" value="text" />
                      <el-option label="urlContains URL包含" value="urlContains" />
                      <el-option label="title 标题" value="title" />
                    </el-select>
                  </el-col>
                  <el-col :span="6" v-if="element.actionType === 'assert'">
                    <div class="field-label">断言值</div>
                    <el-input v-model="element.assertValue" size="small" placeholder="期望值" />
                  </el-col>
                </el-row>
                <el-input v-model="element.description" size="small" placeholder="步骤描述（可选）" style="margin-top:8px" />
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </div>

    <!-- AI 生成面板 -->
    <el-dialog v-model="aiVisible" title="AI 生成浏览器步骤" width="650px" destroy-on-close>
      <div class="ai-panel-body">
        <el-form label-width="80px">
          <el-form-item label="目标URL">
            <el-input v-model="aiForm.targetUrl" placeholder="https://example.com/login" />
          </el-form-item>
          <el-form-item label="自然语言">
            <el-input v-model="aiForm.naturalLang" type="textarea" :rows="5" placeholder="描述你想让浏览器做什么，例如：打开登录页，输入用户名admin，输入密码123456，点击登录按钮，等待3秒，截图保存" />
          </el-form-item>
        </el-form>
        <div v-if="aiResult.length > 0" class="ai-result">
          <div class="ai-result-header">
            <span>生成 {{ aiResult.length }} 个步骤</span>
            <el-button size="small" type="primary" @click="applyAiResult">一键应用</el-button>
          </div>
          <div v-for="(a, i) in aiResult" :key="i" class="ai-step-preview">
            <el-tag size="small">{{ a.actionType }}</el-tag>
            <span>{{ a.description || a.actionName || `步骤 ${i + 1}` }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="aiVisible = false">关闭</el-button>
        <el-button type="primary" @click="generateAiScript" :loading="aiLoading" :icon="MagicStick">生成脚本</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Plus, MagicStick, VideoPlay, List, Rank } from '@element-plus/icons-vue'
import { browserApi } from '../api/browser'
import draggable from 'vuedraggable'

const route = useRoute()
const router = useRouter()
const taskCode = route.params.taskCode

const task = reactive({ taskCode: '', taskName: '', targetUrl: '', description: '' })
const steps = ref([])
const saving = ref(false)
const executing = ref(false)
const editingIndex = ref(-1)

const aiVisible = ref(false)
const aiLoading = ref(false)
const aiForm = reactive({ targetUrl: '', naturalLang: '' })
const aiResult = ref([])

const loadTask = async () => {
  try {
    const res = await browserApi.taskDetail(taskCode)
    const d = res.data
    Object.assign(task, d)
    steps.value = d.actions || []
  } catch (e) {
    ElMessage.error('加载任务失败: ' + (e.response?.data?.message || e.message))
  }
}

const addStep = () => {
  steps.value.push({
    stepIndex: steps.value.length,
    actionType: 'navigate',
    actionName: '步骤 ' + (steps.value.length + 1),
    targetSelector: '',
    targetUrl: '',
    targetFrame: '',
    value: '',
    waitDelayMs: 1000,
    timeoutMs: 30000,
    assertType: '',
    assertValue: '',
    description: '',
    continueOnFail: false,
    extConfig: ''
  })
}

const removeStep = (index) => { steps.value.splice(index, 1); reindex() }
const reindex = () => steps.value.forEach((s, i) => s.stepIndex = i)
const onDragEnd = () => reindex()

const onActionTypeChange = (el) => {
  if (el.actionType === 'wait' && !el.waitDelayMs) el.waitDelayMs = 1000
  if (!el.timeoutMs) el.timeoutMs = 30000
}

const saveSteps = async () => {
  saving.value = true
  try {
    await browserApi.stepAdd({ taskCode, actions: steps.value.map((s, i) => ({ ...s, stepIndex: i })) })
    ElMessage.success('步骤保存成功')
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  } finally { saving.value = false }
}

const runTask = async () => {
  await saveSteps()
  executing.value = true
  try {
    const res = await browserApi.taskExecute(taskCode)
    const execId = res.data?.executionId
    ElMessage.success('执行已启动')
    if (execId) router.push(`/browser/exec/${execId}`)
  } catch (e) {
    ElMessage.error('执行失败: ' + (e.response?.data?.message || e.message))
  } finally { executing.value = false }
}

const openAiPanel = () => {
  aiForm.targetUrl = task.targetUrl || ''
  aiForm.naturalLang = ''
  aiResult.value = []
  aiVisible.value = true
}

const generateAiScript = async () => {
  if (!aiForm.naturalLang) { ElMessage.warning('请输入自然语言描述'); return }
  aiLoading.value = true
  try {
    const res = await browserApi.aiGenerate(aiForm)
    aiResult.value = res.data || []
  } catch (e) {
    ElMessage.error('生成失败: ' + (e.response?.data?.message || e.message))
  } finally { aiLoading.value = false }
}

const applyAiResult = () => {
  steps.value = aiResult.value.map((a, i) => ({ ...a, stepIndex: i }))
  aiVisible.value = false
  ElMessage.success(`已应用 ${steps.value.length} 个步骤`)
}

onMounted(loadTask)
</script>

<style scoped>
.browser-task-editor { display: flex; flex-direction: column; gap: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border: 1px solid rgba(99,102,241,0.08); border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h2 { font-size: 18px; font-weight: 700; color: #1e1b4b; margin: 0; }
.header-right { display: flex; gap: 8px; }
.task-info-bar { display: flex; gap: 24px; padding: 10px 20px; background: rgba(99,102,241,0.04); border-radius: 10px; font-size: 13px; color: #6b7280; }
.task-info-bar strong { color: #4338ca; }
.editor-body { display: flex; gap: 16px; }
.steps-panel { flex: 1; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border: 1px solid rgba(99,102,241,0.1); border-radius: 14px; padding: 16px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 600; color: #1e1b4b; }
.empty-steps { display: flex; flex-direction: column; align-items: center; padding: 48px; color: #9ca3af; }
.empty-steps p { margin-top: 12px; }
.step-card { background: #fff; border: 1px solid rgba(99,102,241,0.08); border-radius: 10px; padding: 12px; margin-bottom: 10px; transition: all 0.2s; }
.step-card:hover { border-color: rgba(99,102,241,0.2); box-shadow: 0 2px 8px rgba(99,102,241,0.06); }
.step-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.drag-handle { cursor: grab; color: #9ca3af; }
.drag-handle:active { cursor: grabbing; }
.step-number { font-weight: 600; font-size: 13px; color: #6366f1; min-width: 32px; }
.step-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.step-body { margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(99,102,241,0.1); }
.field-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; font-weight: 500; }
.ai-panel-body { display: flex; flex-direction: column; gap: 16px; }
.ai-result { border: 1px solid rgba(99,102,241,0.15); border-radius: 10px; padding: 12px; background: rgba(99,102,241,0.02); }
.ai-result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 600; }
.ai-step-preview { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
</style>
