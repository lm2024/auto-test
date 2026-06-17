<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>测试账号管理</span>
          <el-button type="primary" @click="showCreateDialog">新增账号</el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-input v-model="filter.systemName" placeholder="所属系统" clearable style="width:200px" />
        <el-select v-model="filter.status" placeholder="状态" clearable style="width:150px;margin-left:10px">
          <el-option label="可用" :value="1" />
          <el-option label="锁定" :value="2" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" style="margin-left:10px" @click="loadAccounts">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="accounts" border stripe style="margin-top:15px">
        <el-table-column prop="accountCode" label="账号编码" width="140" />
        <el-table-column prop="accountName" label="显示名称" width="150" />
        <el-table-column prop="systemName" label="所属系统" width="120" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column label="密码" width="120">
          <template #default="{ row }">
            <span style="color:#999">••••••</span>
          </template>
        </el-table-column>
        <el-table-column prop="authType" label="认证类型" width="100" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : row.status === 2 ? 'warning' : 'info'">
              {{ row.status === 1 ? '可用' : row.status === 2 ? '锁定' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="editAccount(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteAccount(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
