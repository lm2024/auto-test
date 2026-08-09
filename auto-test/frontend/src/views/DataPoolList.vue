<template>
  <div>
    <t-card>
      <template #header>
        <PageHeader title="数据池管理" description="为接口测试准备可复用的参数化数据">
          <template #actions><t-button theme="primary" @click="showCreateDialog">新增数据池</t-button></template>
        </PageHeader>
      </template>

      <!-- 页面说明 -->
      <div class="page-desc">
        <div class="desc-icon">💡</div>
        <div class="desc-text">
          <strong>什么是数据池？</strong>
          数据池用于存储接口测试的参数化数据。同一条业务链路（如"创建订单"），每轮测试可以用不同的参数执行。
          例如：第一轮用订单 A 的数据，第二轮用订单 B 的数据，无需重复录制链路。
          <br><strong>使用步骤：</strong>
          ① 创建数据池 → ② 定义列（字段名） → ③ 填充行数据 → ④ 在链路或定时任务中绑定数据池
        </div>
      </div>

      <div class="filter-bar">
        <t-input v-model="filter.poolName" placeholder="搜索数据池名称..." clearable style="width:200px" />
        <t-button theme="primary" style="margin-left:10px" @click="loadData">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <!-- 空状态引导 -->
      <div v-if="list.length === 0 && !filter.poolName" class="empty-guide">
        <div class="guide-icon">📦</div>
        <div class="guide-title">还没有数据池</div>
        <div class="guide-steps">
          <div class="step">
            <span class="step-num">1</span>
            <span>点击右上角「新增数据池」，填写名称和列定义</span>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <span>进入数据池，添加测试数据行（或导入 CSV）</span>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <span>在链路编辑器或定时任务中绑定此数据池</span>
          </div>
          <div class="step">
            <span class="step-num">4</span>
            <span>执行时自动使用不同参数运行多轮测试</span>
          </div>
        </div>
        <t-button theme="primary" @click="showCreateDialog" style="margin-top:16px">创建第一个数据池</t-button>
      </div>

      <!-- 数据池列表 -->
      <div v-else class="pool-grid">
        <div v-for="pool in list" :key="pool.id" class="pool-card">
          <div class="pool-header">
            <div class="pool-icon">📊</div>
            <div class="pool-info">
              <div class="pool-name">{{ pool.poolName }}</div>
              <div class="pool-code">编号: {{ pool.poolCode }}</div>
            </div>
            <t-tag :theme="pool.status === 1 ? 'success' : 'default'" size="small">
              {{ pool.status === 1 ? '启用' : '禁用' }}
            </t-tag>
          </div>
          <div class="pool-meta">
            <span>数据行数: <strong>{{ pool.rowCount || 0 }}</strong></span>
            <span>{{ formatTime(pool.createTime) }}</span>
          </div>
          <div class="pool-desc" v-if="pool.description">{{ pool.description }}</div>
          <div class="pool-actions">
            <t-button size="small" @click="goToEditor(pool)">📝 编辑数据</t-button>
            <t-button size="small" variant="outline" @click="editPool(pool)">⚙️ 设置</t-button>
            <t-button theme="danger" size="small" variant="text" @click="deletePool(pool)">删除</t-button>
          </div>
        </div>
      </div>

      <div class="pagination-bar" v-if="total > pageSize">
        <t-pagination
          :current="pageNo"
          :page-size="pageSize"
          :total="total"
          show-jumper
          @change="onPageChange"
        />
      </div>
    </t-card>

    <!-- 新增/编辑对话框 -->
    <t-dialog v-model:visible="dialogVisible" :header="isEdit ? '编辑数据池' : '新增数据池'" width="550px">
      <div class="dialog-tip" v-if="!isEdit">
        💡 数据池 = 参数化测试的数据源。定义好列（字段名）后，每行就是一组测试参数。
      </div>
      <t-form :data="form" label-width="80px">
        <t-form-item label="编码" name="poolCode">
          <t-input v-model="form.poolCode" :disabled="isEdit" placeholder="如: POOL_ORDER（英文+下划线）" />
          <div class="field-hint">唯一标识，绑定链路时使用</div>
        </t-form-item>
        <t-form-item label="名称" name="poolName">
          <t-input v-model="form.poolName" placeholder="如: 订单测试数据" />
        </t-form-item>
        <t-form-item label="描述" name="description">
          <t-textarea v-model="form.description" :autosize="{ minRows: 2, maxRows: 3 }" placeholder="可选：说明这个数据池的用途" />
        </t-form-item>
        <t-form-item label="列定义" name="columnDefs">
          <div class="column-defs-editor">
            <div class="column-def-header">
              <span style="width:120px">字段名</span>
              <span style="width:100px;margin-left:6px">类型</span>
              <span style="width:120px;margin-left:6px">中文标签</span>
            </div>
            <div v-for="(col, idx) in columnDefs" :key="idx" class="column-def-row">
              <t-input v-model="col.name" placeholder="如: orderId" style="width:120px" />
              <t-select v-model="col.type" style="width:100px;margin-left:6px">
                <t-option label="文本" value="STRING" />
                <t-option label="数字" value="NUMBER" />
                <t-option label="布尔" value="BOOLEAN" />
              </t-select>
              <t-input v-model="col.label" placeholder="如: 订单号" style="width:120px;margin-left:6px" />
              <t-button size="small" theme="danger" variant="text" @click="removeColumn(idx)">×</t-button>
            </div>
            <t-button size="small" variant="outline" @click="addColumn">+ 添加字段</t-button>
          </div>
          <div class="field-hint">定义数据池的字段结构，后续每行数据按此结构填写</div>
        </t-form-item>
      </t-form>
      <template #footer>
        <t-button @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="handleSubmit" :loading="submitting">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import api from '../api'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()
const list = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(10)
const filter = reactive({ poolName: '' })
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const form = reactive({ id: null, poolCode: '', poolName: '', description: '', columnDefs: '[]' })
const columnDefs = ref([])

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

const loadData = async () => {
  try {
    const res = await api.get('/datapool/list', {
      params: { poolName: filter.poolName || undefined, pageNo: pageNo.value, pageSize: pageSize.value }
    })
    if (res.code === 200) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (e) {
    MessagePlugin.error('加载失败')
  }
}

const resetFilter = () => { filter.poolName = ''; pageNo.value = 1; loadData() }
const onPageChange = (info) => { pageNo.value = info.current; pageSize.value = info.pageSize; loadData() }

const addColumn = () => { columnDefs.value.push({ name: '', type: 'STRING', label: '' }) }
const removeColumn = (idx) => { columnDefs.value.splice(idx, 1) }

const showCreateDialog = () => {
  isEdit.value = false
  Object.assign(form, { id: null, poolCode: '', poolName: '', description: '' })
  columnDefs.value = [{ name: '', type: 'STRING', label: '' }]
  dialogVisible.value = true
}

const editPool = (pool) => {
  isEdit.value = true
  Object.assign(form, { id: pool.id, poolCode: pool.poolCode, poolName: pool.poolName, description: pool.description })
  try {
    columnDefs.value = JSON.parse(pool.columnDefs || '[]')
  } catch { columnDefs.value = [] }
  dialogVisible.value = true
}

const goToEditor = (pool) => { router.push(`/datapool/edit/${pool.poolCode}`) }

const handleSubmit = async () => {
  if (!form.poolCode.trim()) return MessagePlugin.warning('请输入编码')
  if (!form.poolName.trim()) return MessagePlugin.warning('请输入名称')
  const validCols = columnDefs.value.filter(c => c.name.trim())
  if (validCols.length === 0) return MessagePlugin.warning('请至少添加一个字段')
  form.columnDefs = JSON.stringify(validCols)
  submitting.value = true
  try {
    if (isEdit.value) {
      await api.put('/datapool/update', form)
      MessagePlugin.success('更新成功')
    } else {
      await api.post('/datapool/create', form)
      MessagePlugin.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    MessagePlugin.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const deletePool = (pool) => {
  DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除数据池「${pool.poolName}」及其所有行数据吗？此操作不可恢复。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.delete('/datapool/delete', { params: { id: pool.id } })
        MessagePlugin.success('删除成功')
        loadData()
      } catch (e) { MessagePlugin.error('删除失败') }
    }
  })
}

onMounted(loadData)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }

.page-desc {
  display: flex; gap: 10px; padding: 12px 16px; margin-bottom: 16px;
  background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; line-height: 1.6;
}
.desc-icon { font-size: 20px; flex-shrink: 0; }
.desc-text { color: #334155; }
.desc-text strong { color: #0c4a6e; }

.filter-bar { display: flex; align-items: center; margin-bottom: 15px; }

.empty-guide {
  text-align: center; padding: 48px 20px; background: #fafafa; border-radius: 8px;
}
.guide-icon { font-size: 48px; margin-bottom: 12px; }
.guide-title { font-size: 18px; font-weight: 500; margin-bottom: 16px; color: #333; }
.guide-steps { display: inline-flex; flex-direction: column; gap: 10px; text-align: left; }
.guide-steps .step { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #555; }
.step-num {
  width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;
}

.pool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.pool-card { border: 1px solid #eee; border-radius: 8px; padding: 16px; transition: box-shadow 0.2s; }
.pool-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.pool-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.pool-icon { font-size: 24px; }
.pool-info { flex: 1; }
.pool-name { font-weight: 500; font-size: 15px; }
.pool-code { font-size: 12px; color: #999; }
.pool-meta { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 6px; }
.pool-desc { font-size: 12px; color: #999; margin-bottom: 8px; }
.pool-actions { display: flex; gap: 6px; padding-top: 8px; border-top: 1px solid #f0f0f0; }

.empty-state { grid-column: 1 / -1; text-align: center; padding: 40px; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 15px; }

.dialog-tip { padding: 8px 12px; margin-bottom: 12px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; font-size: 12px; color: #8c6e00; }
.field-hint { font-size: 12px; color: #999; margin-top: 2px; }
.column-defs-editor { width: 100%; }
.column-def-header { display: flex; font-size: 12px; color: #999; margin-bottom: 4px; }
.column-def-row { display: flex; align-items: center; margin-bottom: 6px; }
</style>
