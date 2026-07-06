<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>浏览器插件</span>
        </div>
      </template>

      <div class="plugin-info">
        <div class="plugin-hero">
          <img src="/icons/icon128.png" alt="插件图标" class="plugin-icon" />
          <div class="plugin-meta">
            <h2>捉接口 TraceFlow</h2>
            <p class="version">v1.1.0</p>
            <p class="desc">录制页面所有网络请求，支持链路回放与版本对比，一键推送至自动化测试平台</p>
          </div>
        </div>

        <el-divider />

        <div class="section">
          <h3>支持的浏览器</h3>
          <div class="browser-list">
            <el-tag type="primary" size="large">Google Chrome 88+</el-tag>
            <el-tag type="info" size="large">Microsoft Edge 88+</el-tag>
            <el-tag type="warning" size="large">其他 Chromium 内核浏览器</el-tag>
          </div>
        </div>

        <el-divider />

        <div class="section">
          <h3>下载安装</h3>
          <el-button type="primary" size="large" @click="downloadPlugin">
            <el-icon><Download /></el-icon>
            下载插件 (.crx)
          </el-button>
          <div class="install-steps">
            <h4>安装方法：</h4>
            <ol>
              <li>下载 .crx 文件</li>
              <li>打开浏览器，访问 <code>chrome://extensions</code></li>
              <li>开启右上角「开发者模式」</li>
              <li>将下载的 .crx 文件拖入页面即可安装</li>
            </ol>
          </div>
        </div>

        <el-divider />

        <div class="section">
          <h3>更新日志</h3>
          <el-timeline>
            <el-timeline-item timestamp="2026-06-17" placement="top" type="primary">
              <el-card shadow="never">
                <h4>v1.1.0</h4>
                <ul>
                  <li>支持操作级 TraceId 分组</li>
                  <li>支持浏览器事件录制（点击、输入等）</li>
                  <li>支持并行分组标识</li>
                  <li>优化请求体参数依赖自动识别</li>
                </ul>
              </el-card>
            </el-timeline-item>
            <el-timeline-item timestamp="2026-06-10" placement="top">
              <el-card shadow="never">
                <h4>v1.0.0</h4>
                <ul>
                  <li>初始版本发布</li>
                  <li>支持录制网络请求</li>
                  <li>支持一键推送至平台</li>
                  <li>支持链路追加模式</li>
                </ul>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { Download } from '@element-plus/icons-vue'

const downloadPlugin = () => {
  const link = document.createElement('a')
  link.href = '/plugin-test.crx'
  link.download = 'traceflow-plugin.crx'
  link.click()
}
</script>

<style scoped>
.card-header {
  font-size: 18px;
  font-weight: 700;
  color: #1e1b4b;
}

.plugin-hero {
  display: flex;
  align-items: center;
  gap: 24px;
}

.plugin-icon {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.plugin-meta h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e1b4b;
  margin-bottom: 4px;
}

.version {
  color: #6366f1;
  font-weight: 600;
  margin-bottom: 8px;
}

.desc {
  color: #6b7280;
  font-size: 14px;
}

.section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e1b4b;
  margin-bottom: 12px;
}

.browser-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.install-steps {
  margin-top: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.install-steps h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.install-steps ol {
  padding-left: 20px;
  color: #4b5563;
  line-height: 2;
}

.install-steps code {
  background: #e5e7eb;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
