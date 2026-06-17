import { createRouter, createWebHistory } from 'vue-router'

const routes = [
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
    path: '/dict/category',
    name: 'DictCategory',
    component: () => import('../views/DictCategory.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router