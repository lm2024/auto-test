import { get, post, del, put } from '@/api/request';

/* 账号管理 */
export const getAccountList = (params) => get('/account/list', params);
export const addAccount = (data) => post('/account/create', data);
export const updateAccount = (data) => put('/account/update?id=' + data.id, data);
export const deleteAccount = (id) => del('/account/delete', { params: { id } });

/* 流程管理 */
export const getChainList = (params) => get('/chain/list', params);
export const getChainDetail = (chainCode) => get('/chain/detail', { params: { chainCode } });
export const addChain = (data) => post('/chain/create', data);
export const updateChain = (data) => post('/chain/edit', data);
export const deleteChain = (chainCode) => post('/chain/delete', null, { params: { chainCode } });

/* 执行管理 */
export const getExecuteList = (params) => get('/execute/list', params);
export const getExecuteDetail = (executionId) => get('/execute/status', { params: { executionId } });
export const runChain = (chainCode) => post('/execute/run', { chainCode });

/* 定时任务 */
export const getScheduledTaskList = (params) => get('/task/list', params);
export const addScheduledTask = (data) => post('/task/create', data);
export const updateScheduledTask = (data) => put('/task/update?id=' + data.id, data);
export const deleteScheduledTask = (id) => del('/task/delete', { params: { id } });

/* 用户管理 */
export const getUserList = (params) => get('/user/list', params);
export const addUser = (data) => post('/user/create', data);
export const updateUser = (data) => put('/user/update?id=' + data.id, data);
export const deleteUser = (id) => del('/user/delete', { params: { id } });

/* 系统配置 */
export const getSystemConfig = () => get('/config/all');
export const updateSystemConfig = (data) => post('/config/save', data);

/* 字典管理 */
export const getDictCategory = (params) => get('/dict/category/list', params);

/* 插件管理 */
export const getPluginList = (params) => get('/plugin/chain/list', params);

/* 认证 */
export const login = (data) => post('/user/login', data);

export default { get, post, del, put, getAccountList, addAccount, updateAccount, deleteAccount, getChainList, getChainDetail, addChain, updateChain, deleteChain, getExecuteList, getExecuteDetail, runChain, getScheduledTaskList, addScheduledTask, updateScheduledTask, deleteScheduledTask, getUserList, addUser, updateUser, deleteUser, getSystemConfig, updateSystemConfig, getDictCategory, getPluginList, login };
