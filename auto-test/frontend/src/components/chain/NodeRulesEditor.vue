<template>
  <div class="rules-editor">
    <!-- 提取规则 -->
    <template v-if="mode === 'extract'">
      <div class="hint-box">
        <InfoCircleIcon />
        <span>提取响应数据保存为变量，供后续节点使用（如 token、用户ID）</span>
      </div>
      <div v-for="(rule, idx) in extractList" :key="'e' + idx" class="rule-row">
        <div class="rule-row-header">
          <span class="rule-index">#{{ idx + 1 }}</span>
          <t-button variant="text" theme="danger" size="small" shape="square" @click="removeExtract(idx)">
            <template #icon><DeleteIcon /></template>
          </t-button>
        </div>
        <div class="rule-fields">
          <div class="rule-field">
            <div class="rule-field-label">变量名称</div>
            <t-input v-model="rule.varName" size="small" placeholder="例如: token" clearable @change="emitExtract" />
          </div>
          <div class="rule-field">
            <div class="rule-field-label">提取路径</div>
            <t-input v-model="rule.jsonPath" size="small" placeholder="例如: $.data.token" clearable @change="emitExtract" />
          </div>
        </div>
        <div class="path-examples">
          <t-tag v-for="p in PATH_SAMPLES" :key="p" size="small" theme="default" @click="applyPath(rule, p)">{{ p }}</t-tag>
        </div>
      </div>
      <t-button theme="primary" variant="outline" size="small" block @click="addExtract">
        <template #icon><AddIcon /></template>添加提取规则
      </t-button>
    </template>

    <!-- 断言规则 -->
    <template v-else>
      <div class="hint-box">
        <InfoCircleIcon />
        <span>设置验证条件，执行后自动检查响应是否符合预期</span>
      </div>

      <div class="assert-group">
        <div class="assert-group-title">状态码检查</div>
        <t-input
          v-model="statusCode"
          size="small"
          placeholder="例如: 200，留空则不校验"
          clearable
          @change="emitAssert"
        />
      </div>

      <div class="assert-group">
        <div class="assert-group-title">响应体字段检查</div>
        <div v-for="(rule, idx) in bodyRules" :key="'a' + idx" class="rule-row">
          <div class="rule-row-header">
            <span class="rule-index">#{{ idx + 1 }}</span>
            <t-button variant="text" theme="danger" size="small" shape="square" @click="removeBody(idx)">
              <template #icon><DeleteIcon /></template>
            </t-button>
          </div>
          <div class="rule-fields">
            <div class="rule-field">
              <div class="rule-field-label">字段路径</div>
              <t-input v-model="rule.path" size="small" placeholder="$.data.code" clearable @change="emitAssert" />
            </div>
            <div class="rule-field" style="flex:0 0 110px">
              <div class="rule-field-label">条件</div>
              <t-select v-model="rule.operator" size="small" @change="emitAssert">
                <t-option label="等于" value="eq" />
                <t-option label="非空" value="notNull" />
              </t-select>
            </div>
          </div>
          <div v-if="rule.operator !== 'notNull'" class="rule-field">
            <div class="rule-field-label">期望值</div>
            <t-input v-model="rule.expected" size="small" placeholder="例如: 200 / success" clearable @change="emitAssert" />
          </div>
        </div>
        <t-button theme="primary" variant="outline" size="small" block @click="addBody">
          <template #icon><AddIcon /></template>添加断言
        </t-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { AddIcon, DeleteIcon, InfoCircleIcon } from 'tdesign-icons-vue-next'

const props = defineProps({
  mode: { type: String, default: 'extract' }, // extract | assert
  extractRules: { type: String, default: '' },
  assertRules: { type: String, default: '' }
})
const emit = defineEmits(['update:extractRules', 'update:assertRules'])

const PATH_SAMPLES = ['$.data.id', '$.data.token', '$.data.items[0].name']
const NOT_NULL = '__NOT_NULL__'

const extractList = ref([])
const statusCode = ref('')
const bodyRules = ref([])

function parseExtract(raw) {
  try {
    if (!raw) return []
    const obj = JSON.parse(raw)
    return (obj.rules || []).map((r) => ({ varName: r.varName || '', jsonPath: r.jsonPath || '' }))
  } catch {
    return []
  }
}

function parseAssert(raw) {
  const result = { statusCode: '', body: [] }
  try {
    if (!raw) return result
    const obj = JSON.parse(raw)
    if (obj.statusCode !== undefined && obj.statusCode !== null && obj.statusCode !== '') {
      result.statusCode = String(obj.statusCode)
    }
    result.body = Object.entries(obj.body || {}).map(([path, expected]) => ({
      path,
      operator: expected === NOT_NULL ? 'notNull' : 'eq',
      expected: expected === NOT_NULL ? '' : String(expected)
    }))
  } catch {
    /* 忽略非法 JSON，按空规则处理 */
  }
  return result
}

watch(
  () => props.extractRules,
  (raw) => {
    extractList.value = parseExtract(raw)
  },
  { immediate: true }
)

watch(
  () => props.assertRules,
  (raw) => {
    const parsed = parseAssert(raw)
    statusCode.value = parsed.statusCode
    bodyRules.value = parsed.body
  },
  { immediate: true }
)

function emitExtract() {
  const rules = extractList.value.filter((r) => r.varName && r.jsonPath)
  emit('update:extractRules', rules.length ? JSON.stringify({ rules }) : '')
}

function emitAssert() {
  const obj = {}
  if (statusCode.value !== '' && statusCode.value !== null) {
    const n = parseInt(statusCode.value, 10)
    obj.statusCode = Number.isNaN(n) ? statusCode.value : n
  }
  const body = {}
  bodyRules.value.forEach((r) => {
    if (!r.path) return
    if (r.operator === 'notNull') {
      body[r.path] = NOT_NULL
    } else {
      body[r.path] = r.expected !== '' && !Number.isNaN(Number(r.expected)) ? Number(r.expected) : r.expected
    }
  })
  if (Object.keys(body).length) obj.body = body
  emit('update:assertRules', Object.keys(obj).length ? JSON.stringify(obj) : '')
}

function addExtract() {
  extractList.value.push({ varName: '', jsonPath: '' })
}
function removeExtract(idx) {
  extractList.value.splice(idx, 1)
  emitExtract()
}
function applyPath(rule, p) {
  rule.jsonPath = p
  emitExtract()
}
function addBody() {
  bodyRules.value.push({ path: '', operator: 'eq', expected: '' })
}
function removeBody(idx) {
  bodyRules.value.splice(idx, 1)
  emitAssert()
}
</script>

<style scoped>
.rules-editor { display: flex; flex-direction: column; gap: 12px; }
.hint-box {
  display: flex; align-items: flex-start; gap: 6px;
  background: #f2f5fa; border-radius: 6px; padding: 8px 10px;
  font-size: 12px; color: #4e5969; line-height: 1.5;
}
.rule-row {
  border: 1px solid #e5e6eb; border-radius: 8px;
  padding: 10px; display: flex; flex-direction: column; gap: 8px;
  background: #fafbfc;
}
.rule-row-header { display: flex; align-items: center; justify-content: space-between; }
.rule-index { font-size: 12px; font-weight: 600; color: #86909c; }
.rule-fields { display: flex; gap: 8px; }
.rule-field { flex: 1 1 0; min-width: 0; }
.rule-field-label { font-size: 12px; color: #4e5969; margin-bottom: 4px; }
.path-examples { display: flex; flex-wrap: wrap; gap: 6px; }
.path-examples :deep(.t-tag) { cursor: pointer; }
.assert-group { display: flex; flex-direction: column; gap: 8px; }
.assert-group-title { font-size: 13px; font-weight: 600; color: #1d2129; }
</style>
