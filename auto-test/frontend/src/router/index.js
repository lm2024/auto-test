import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from '../utils/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  { path: '/', redirect: '/chain/list' },
  {
    path: '/chain/list',
    name: 'ChainList',
    component: () => import('../views/ChainList.vue')
  },
  {
    path: '/chain/edit/:chainCode',
    name: 'ChainEdit',
    component: () => import('../views/ChainEdit.vue')
  },
  {
    path: '/execute/list',
    name: 'ExecuteList',
    component: () => import('../views/ExecuteList.vue')
  },
  {
    path: '/execute/detail/:executionId',
    name: 'ExecuteDetail',
    component: () => import('../views/ExecuteDetail.vue')
  },
  {
    path: '/system/config',
    name: 'SystemConfig',
    component: () => import('../views/SystemConfig.vue')
  },
  {
    path: '/account/list',
    name: 'AccountList',
    component: () => import('../views/AccountList.vue')
  },
  {
    path: '/account/login-wizard',
    name: 'LoginWizard',
    component: () => import('../views/LoginWizard.vue')
  },
  {
    path: '/dict/category',
    name: 'DictCategory',
    component: () => import('../views/DictCategory.vue')
  },
  {
    path: '/plugin/download',
    name: 'PluginDownload',
    component: () => import('../views/PluginDownload.vue')
  },
  {
    path: '/user/list',
    name: 'UserList',
    component: () => import('../views/UserList.vue')
  },
  {
    path: '/scheduled-task',
    name: 'ScheduledTask',
    component: () => import('../views/ScheduledTask.vue')
  },
  {
    path: '/system/registry',
    name: 'SystemRegistry',
    component: () => import('../views/SystemRegistry.vue')
  },
  {
    path: '/tenant/list',
    name: 'TenantManage',
    component: () => import('../views/TenantManage.vue')
  },
  {
    path: '/product/list',
    name: 'ProductManage',
    component: () => import('../views/ProductManage.vue')
  },
  {
    path: '/datapool/list',
    name: 'DataPoolList',
    component: () => import('../views/DataPoolList.vue')
  },
  {
    path: '/datapool/edit/:poolCode',
    name: 'DataPoolEditor',
    component: () => import('../views/DataPoolEditor.vue')
  },
  {
    path: '/call-graph',
    name: 'CallGraph',
    component: () => import('../views/CallGraph.vue')
  },
  {
    path: '/theme-preview',
    name: 'ThemePreview',
    component: () => import('../views/ThemePreview.vue'),
    meta: { public: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.public) {
    next()
  } else if (!isLoggedIn()) {
    next('/login')
  } else {
    next()
  }
})

export default router
