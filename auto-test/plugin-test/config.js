// plugin-test/config.js
// 插件固定配置：前后端地址等由开发者人为指定，不可由用户在设置页修改。
// 同时兼容 Service Worker(self) 与页面(window) 两种运行环境。
(function () {
  'use strict';
  var CFG = {
    // 后端 API 地址（自动化测试平台服务）
    PLATFORM_URL: 'http://localhost:9093',
    // 前端页面地址（用于读取登录态 token：autotest_token / autotest_user）
    FRONTEND_URL: 'http://localhost:9094'
  };
  if (typeof self !== 'undefined') self.AUTOTEST_CONFIG = CFG;
  if (typeof window !== 'undefined') window.AUTOTEST_CONFIG = CFG;
})();
