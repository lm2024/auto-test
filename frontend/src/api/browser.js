import api from './index'

export const browserApi = {
  /** 获取任务列表 */
  taskList(params = {}) {
    return api.get('/browser/task/list', { params })
  },
  /** 获取任务详情 */
  taskDetail(taskCode) {
    return api.get('/browser/task/detail', { params: { taskCode } })
  },
  /** 创建任务 */
  taskCreate(data) {
    return api.post('/browser/task/create', data)
  },
  /** 更新任务 */
  taskUpdate(data) {
    return api.post('/browser/task/update', data)
  },
  /** 删除任务 */
  taskDelete(taskCode) {
    return api.post('/browser/task/delete', { taskCode })
  },
  /** 执行任务 */
  taskExecute(taskCode) {
    return api.post('/browser/task/execute', { taskCode })
  },
  /** 添加步骤 */
  stepAdd(data) {
    return api.post('/browser/task/step/add', data)
  },
  /** 更新步骤 */
  stepUpdate(data) {
    return api.post('/browser/task/step/update', data)
  },
  /** 删除步骤 */
  stepDelete(stepId) {
    return api.post('/browser/task/step/delete', { stepId })
  },
  /** 步骤排序 */
  stepSort(data) {
    return api.post('/browser/task/step/sort', data)
  },
  /** 获取执行记录列表 */
  execList(taskCode, params = {}) {
    return api.get('/browser/exec/list', { params: { taskCode, ...params } })
  },
  /** 获取执行详情 */
  execDetail(executionId) {
    // 根据 executionId 前缀决定用哪个 API
    if (executionId && executionId.startsWith('AIEXEC_')) {
      return api.get('/execute/ai-exec/detail', { params: { executionId } })
    }
    return api.get('/browser/exec/detail', { params: { executionId } })
  },
  /** 获取步骤日志 */
  stepLogs(executionId) {
    if (executionId && executionId.startsWith('AIEXEC_')) {
      return api.get('/execute/ai-exec/stepLogs', { params: { executionId } })
    }
    return api.get('/browser/exec/stepLogs', { params: { executionId } })
  },
  /** 获取截图 */
  screenshotUrl(executionId, stepIndex) {
    return `/api/browser/exec/screenshot?executionId=${executionId}&stepIndex=${stepIndex}`
  },
  /** AI 生成脚本 */
  aiGenerate(data) {
    return api.post('/browser/ai/generate', data)
  },
  /** AI 分析截图 */
  aiAnalyze(data) {
    return api.post('/browser/ai/analyze', data)
  },
  /** 定时任务配置 */
  scheduleSave(data) {
    return api.post('/browser/schedule/save', data)
  },
  scheduleGet(taskCode) {
    return api.get('/browser/schedule/get', { params: { taskCode } })
  },
  scheduleDelete(taskCode) {
    return api.post('/browser/schedule/delete', { taskCode })
  }
}

export default browserApi
