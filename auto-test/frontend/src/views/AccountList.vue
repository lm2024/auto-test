<template>
  <div class="account-page">
    <PageHeader title="测试账号管理" description="按目标系统复用账号，查看当前占用和完整使用轨迹">
      <template #actions>
        <t-button variant="text" @click="goWizard">登录配置向导</t-button>
        <t-button theme="primary" @click="showCreateDialog">新增账号</t-button>
      </template>
    </PageHeader>

    <section class="summary-grid">
      <div class="summary-item"><span>当前页账号</span><strong>{{ accounts.length }}</strong></div>
      <div class="summary-item"><span>可立即使用</span><strong class="success-text">{{ availableCount }}</strong></div>
      <div class="summary-item"><span>使用中</span><strong class="warning-text">{{ lockedCount }}</strong></div>
      <div class="summary-item"><span>需要续租</span><strong class="danger-text">{{ expiringCount }}</strong></div>
    </section>

    <div class="filter-bar">
      <t-input v-model="filter.systemName" placeholder="搜索所属系统" clearable style="width:220px" @enter="search" />
      <t-select v-model="filter.status" placeholder="账号状态" clearable style="width:150px">
        <t-option label="可用" :value="1" /><t-option label="锁定" :value="2" /><t-option label="禁用" :value="0" />
      </t-select>
      <t-button theme="primary" @click="search">查询</t-button>
      <t-button variant="text" @click="resetFilter">重置</t-button>
    </div>

    <t-table :data="accounts" :columns="accountColumns" row-key="id" bordered stripe>
      <template #accountName="{ row }">
        <div class="account-name"><strong>{{ row.accountName }}</strong><span>{{ row.accountCode }}</span></div>
      </template>
      <template #status="{ row }">
        <t-tag :theme="stateOf(row).theme">{{ stateOf(row).label }}</t-tag>
        <span v-if="row.lockUntil && row.status === 2" class="sub-text">锁至 {{ formatTime(row.lockUntil) }}</span>
      </template>
      <template #validUntil="{ row }">
        <span :class="{ 'danger-text': isExpired(row), 'warning-text': isExpiring(row) }">{{ validityText(row) }}</span>
      </template>
      <template #lastUsedTime="{ row }">{{ formatTime(row.lastUsedTime) }}</template>
      <template #operate="{ row }">
        <ActionMenu :items="[
          { label: '使用记录', command: 'usage', icon: HistoryIcon },
          { label: '编辑', command: 'edit', icon: EditIcon },
          { label: '续租 30 天', command: 'renew', icon: RefreshIcon, divided: true },
          { label: '删除', command: 'delete', icon: DeleteIcon, danger: true }
        ]" @command="(cmd) => onAccountCommand(cmd, row)" />
      </template>
    </t-table>

    <div class="pagination-bar"><t-pagination :current="pageNo" :page-size="pageSize" :page-size-options="[10,20,50,100]" :total="total" show-jumper @change="onPageChange" /></div>

    <t-dialog v-model:visible="dialogVisible" :header="dialogTitle" width="620px">
      <t-form :data="form" label-width="105px">
        <div class="form-section">基础信息</div>
        <t-form-item label="账号编码"><t-input v-model="form.accountCode" :disabled="isEdit" placeholder="如 UAT_ADMIN_01" /></t-form-item>
        <t-form-item label="账号名称"><t-input v-model="form.accountName" placeholder="给团队成员看的名称" /></t-form-item>
        <t-form-item label="所属系统"><t-input v-model="form.systemName" placeholder="如 订单中心" /></t-form-item>
        <t-form-item label="产品编码"><t-input v-model="form.productCode" placeholder="可选，用于跨页面筛选" /></t-form-item>
        <t-form-item label="用户名"><t-input v-model="form.username" /></t-form-item>
        <t-form-item label="密码"><t-input v-model="form.password" type="password" :placeholder="isEdit ? '留空表示不修改' : '仅在保存时加密'" /></t-form-item>
        <div class="form-section">有效期与认证</div>
        <t-form-item label="有效期开始"><t-date-picker v-model="form.validFrom" enable-time-picker clearable style="width:100%" /></t-form-item>
        <t-form-item label="有效期结束"><t-date-picker v-model="form.validUntil" enable-time-picker clearable style="width:100%" /></t-form-item>
        <t-form-item label="登录方式"><t-select v-model="form.loginType"><t-option label="HTTP 密码登录" value="HTTP" /><t-option label="Cookie 会话" value="COOKIE" /><t-option label="OAuth2" value="OAUTH2_CODE" /><t-option label="CAS 统一认证" value="CAS" /><t-option label="浏览器自动登录" value="PLAYWRIGHT" /><t-option label="静态 Token" value="TOKEN" /></t-select></t-form-item>
        <t-form-item label="登录配置"><t-textarea v-model="form.loginConfig" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="JSON 登录配置；复杂配置可先用向导验证" /></t-form-item>
      </t-form>
      <template #footer><t-button variant="text" @click="dialogVisible = false">取消</t-button><t-button theme="primary" :loading="saving" @click="submitForm">保存账号</t-button></template>
    </t-dialog>

    <t-drawer v-model:visible="usageVisible" :header="usageTitle" size="720px" :footer="false">
      <div class="usage-summary"><span>账号使用记录</span><strong>{{ usageTotal }} 条</strong></div>
      <t-table :data="usageList" :columns="usageColumns" row-key="id" size="small" bordered>
        <template #status="{ row }"><t-tag :theme="row.status === 'SUCCESS' || row.status === 'FINISHED' ? 'success' : row.status === 'RUNNING' ? 'warning' : 'danger'">{{ row.status }}</t-tag></template>
        <template #durationMs="{ row }">{{ row.durationMs == null ? '-' : row.durationMs + ' ms' }}</template>
        <template #startedAt="{ row }">{{ formatTime(row.startedAt) }}</template>
      </t-table>
      <div class="pagination-bar"><t-pagination :current="usagePage" :page-size="20" :total="usageTotal" @change="loadUsage" /></div>
    </t-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { DeleteIcon, EditIcon, HistoryIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import { useRouter } from 'vue-router'
import api from '../api'
import ActionMenu from '../components/ActionMenu.vue'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()
const accounts = ref([]); const total = ref(0); const pageNo = ref(1); const pageSize = ref(10)
const filter = ref({ systemName: '', status: null }); const dialogVisible = ref(false); const dialogTitle = ref('新增账号'); const isEdit = ref(false); const editId = ref(null); const saving = ref(false)
const usageVisible = ref(false); const usageAccount = ref(null); const usageList = ref([]); const usageTotal = ref(0); const usagePage = ref(1)
const emptyForm = () => ({ accountCode: '', accountName: '', systemName: '', productCode: '', username: '', password: '', authType: 'PASSWORD', authConfig: '', loginType: 'HTTP', loginConfig: '', validFrom: null, validUntil: null })
const form = ref(emptyForm())
const accountColumns = [
  { colKey: 'accountName', title: '账号', width: 220 }, { colKey: 'systemName', title: '所属系统', width: 140 },
  { colKey: 'username', title: '用户名', width: 140 }, { colKey: 'loginType', title: '登录方式', width: 130 },
  { colKey: 'status', title: '资源状态', width: 150 }, { colKey: 'validUntil', title: '有效期', width: 180 },
  { colKey: 'lastUsedTime', title: '最近使用', width: 180 }, { colKey: 'operate', title: '操作', width: 90, fixed: 'right', align: 'center', className: 'action-column' }
]
const usageColumns = [
  { colKey: 'operatorName', title: '使用者', width: 110 }, { colKey: 'usageType', title: '场景', width: 90 },
  { colKey: 'chainCode', title: '链路', width: 150 }, { colKey: 'dataPoolCode', title: '数据池', width: 120 },
  { colKey: 'status', title: '结果', width: 90 }, { colKey: 'durationMs', title: '耗时', width: 100 }, { colKey: 'startedAt', title: '开始时间', width: 160 }
]
const now = () => new Date()
const isExpired = row => row.validUntil && new Date(row.validUntil) <= now()
const isExpiring = row => row.validUntil && !isExpired(row) && new Date(row.validUntil).getTime() - Date.now() < 7 * 86400000
const stateOf = row => row.status === 0 ? { label: '已禁用', theme: 'default' } : row.status === 2 ? { label: '使用中', theme: 'warning' } : isExpired(row) ? { label: '已过期', theme: 'danger' } : { label: '可使用', theme: 'success' }
const availableCount = computed(() => accounts.value.filter(row => stateOf(row).label === '可使用').length)
const lockedCount = computed(() => accounts.value.filter(row => row.status === 2).length)
const expiringCount = computed(() => accounts.value.filter(row => isExpired(row) || isExpiring(row)).length)
const formatTime = value => value ? new Date(value).toLocaleString() : '-'
const validityText = row => !row.validUntil ? '长期有效' : isExpired(row) ? '已过期' : formatTime(row.validUntil)
const loadAccounts = async () => { const res = await api.get('/account/list', { params: { ...filter.value, pageNo: pageNo.value, pageSize: pageSize.value } }); accounts.value = res.data?.list || []; total.value = res.data?.total || 0 }
const search = () => { pageNo.value = 1; loadAccounts() }
const resetFilter = () => { filter.value = { systemName: '', status: null }; search() }
const onPageChange = info => { pageNo.value = info.current; pageSize.value = info.pageSize; loadAccounts() }
const showCreateDialog = () => { dialogTitle.value = '新增测试账号'; isEdit.value = false; editId.value = null; form.value = emptyForm(); dialogVisible.value = true }
const editAccount = row => { dialogTitle.value = '编辑测试账号'; isEdit.value = true; editId.value = row.id; form.value = { ...emptyForm(), ...row, password: '' }; dialogVisible.value = true }
const submitForm = async () => {
  if (!form.value.accountCode || !form.value.accountName || !form.value.username || (!isEdit.value && !form.value.password)) return MessagePlugin.warning('请先补齐账号名称、编码、用户名和密码')
  saving.value = true
  try { if (isEdit.value) await api.put('/account/update?id=' + editId.value, form.value); else await api.post('/account/create', form.value); MessagePlugin.success(isEdit.value ? '账号已更新' : '账号已创建'); dialogVisible.value = false; loadAccounts() } finally { saving.value = false }
}
const renew = async row => { const until = new Date(Math.max(Date.now(), row.validUntil ? new Date(row.validUntil).getTime() : Date.now()) + 30 * 86400000); await api.put('/account/update?id=' + row.id, { validUntil: until.toISOString() }); MessagePlugin.success('已续租 30 天'); loadAccounts() }
const deleteAccount = row => { const dialog = DialogPlugin.confirm({ header: '删除账号', body: '删除后将不能再用于链路和定时任务，确定继续？', theme: 'warning', confirmBtn: '删除', cancelBtn: '取消', onConfirm: async () => { dialog.hide(); await api.delete('/account/delete', { params: { id: row.id } }); MessagePlugin.success('账号已删除'); loadAccounts() } }) }
const loadUsage = async info => { if (info) usagePage.value = info.current; const res = await api.get('/account/usage', { params: { accountId: usageAccount.value.id, pageNo: usagePage.value, pageSize: 20 } }); usageList.value = res.data?.list || []; usageTotal.value = res.data?.total || 0 }
const showUsage = row => { usageAccount.value = row; usagePage.value = 1; usageVisible.value = true; loadUsage() }
const onAccountCommand = (cmd, row) => ({ edit: () => editAccount(row), usage: () => showUsage(row), renew: () => renew(row), delete: () => deleteAccount(row) }[cmd]())
const usageTitle = computed(() => usageAccount.value ? `${usageAccount.value.accountName} · 使用记录` : '使用记录')
const goWizard = () => router.push('/account/login-wizard')
onMounted(loadAccounts)
</script>

<style scoped>
.account-page { padding-bottom: 24px; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
.summary-item { padding: 16px 18px; border: 1px solid var(--border); background: var(--surface); border-radius: 6px; display:flex; justify-content:space-between; align-items:center; }
.summary-item span, .sub-text { color: var(--text-mute); font-size: 13px; }.summary-item strong { font-size: 24px; }.success-text { color: var(--success, #16a05d); }.warning-text { color: var(--warning, #c77b00); }.danger-text { color: var(--danger, #d14343); }
.filter-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin: 4px 0 14px; }.account-name { display:flex; flex-direction:column; gap:3px; }.account-name span { color:var(--text-mute); font-size:12px; }.sub-text { display:block; margin-top:3px; font-size:11px; }.pagination-bar { display:flex; justify-content:flex-end; padding-top:16px; }.form-section { font-size:13px; color:var(--text-mute); border-bottom:1px solid var(--border); padding:8px 0; margin:5px 0 12px; }.usage-summary { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; color:var(--text-mute); }.usage-summary strong { color:var(--text); font-size:18px; }
@media (max-width: 760px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
