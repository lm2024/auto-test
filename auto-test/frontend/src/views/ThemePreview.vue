<template>
  <div class="theme-preview">
    <h1>新主题配色方案预览</h1>
    
    <div class="preview-section">
      <h2>亮色主题</h2>
      <div class="color-palette light">
        <div class="color-item">
          <div class="color-swatch" style="background: #f8f9fa;"></div>
          <span class="color-name">背景色</span>
          <span class="color-code">#f8f9fa</span>
        </div>
        <div class="color-item">
          <div class="color-swatch" style="background: #ffffff;"></div>
          <span class="color-name">表面色</span>
          <span class="color-code">#ffffff</span>
        </div>
        <div class="color-item">
          <div class="color-swatch" style="background: #4a9e8e;"></div>
          <span class="color-name">主色调</span>
          <span class="color-code">#4a9e8e</span>
        </div>
        <div class="color-item">
          <div class="color-swatch" style="background: #2c3e50;"></div>
          <span class="color-name">主文本</span>
          <span class="color-code">#2c3e50</span>
        </div>
      </div>
    </div>

    <div class="preview-section">
      <h2>暗色主题</h2>
      <div class="color-palette dark">
        <div class="color-item">
          <div class="color-swatch" style="background: #1a1f2e;"></div>
          <span class="color-name">背景色</span>
          <span class="color-code">#1a1f2e</span>
        </div>
        <div class="color-item">
          <div class="color-swatch" style="background: #232938;"></div>
          <span class="color-name">表面色</span>
          <span class="color-code">#232938</span>
        </div>
        <div class="color-item">
          <div class="color-swatch" style="background: #5db8a7;"></div>
          <span class="color-name">主色调</span>
          <span class="color-code">#5db8a7</span>
        </div>
        <div class="color-item">
          <div class="color-swatch" style="background: #e8edf3;"></div>
          <span class="color-name">主文本</span>
          <span class="color-code">#e8edf3</span>
        </div>
      </div>
    </div>

    <div class="preview-section">
      <h2>登录页面对比</h2>
      <div class="login-comparison">
        <div class="login-preview light">
          <h3>亮色登录页</h3>
          <div class="login-mock">
            <div class="login-left-mock"></div>
            <div class="login-right-mock"></div>
          </div>
        </div>
        <div class="login-preview dark">
          <h3>暗色登录页</h3>
          <div class="login-mock">
            <div class="login-left-mock dark-left"></div>
            <div class="login-right-mock dark-right"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="preview-section">
      <h2>设计原则</h2>
      <div class="principles">
        <div class="principle">
          <h4>柔和色调</h4>
          <p>使用蓝绿色调替代鲜艳的绿色，降低视觉疲劳</p>
        </div>
        <div class="principle">
          <h4>温暖中性色</h4>
          <p>亮色使用柔和灰白，暗色使用深蓝灰，避免纯黑纯白</p>
        </div>
        <div class="principle">
          <h4>和谐过渡</h4>
          <p>登录页面与主应用使用统一的色彩体系，视觉连贯</p>
        </div>
        <div class="principle">
          <h4>可访问性</h4>
          <p>保持足够的对比度，确保所有用户都能舒适使用</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 预览页面，展示新的配色方案
</script>

<style scoped>
.theme-preview {
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  color: var(--text, #2c3e50);
  margin-bottom: 40px;
  text-align: center;
}

h2 {
  color: var(--text, #2c3e50);
  margin-bottom: 24px;
  border-bottom: 2px solid var(--primary, #4a9e8e);
  padding-bottom: 8px;
}

.preview-section {
  margin-bottom: 40px;
}

.color-palette {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.color-item {
  text-align: center;
}

.color-swatch {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
}

.color-name {
  display: block;
  font-weight: 600;
  color: var(--text, #2c3e50);
  margin-bottom: 4px;
}

.color-code {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--text-mute, #8494a7);
}

.login-comparison {
  display: flex;
  gap: 40px;
  justify-content: center;
}

.login-preview {
  text-align: center;
}

.login-preview h3 {
  margin-bottom: 16px;
  color: var(--text, #2c3e50);
}

.login-mock {
  width: 300px;
  height: 200px;
  display: flex;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-2, 0 8px 24px rgba(0, 0, 0, 0.08));
}

.login-left-mock {
  flex: 1;
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
}

.login-right-mock {
  flex: 1;
  background: var(--surface, #ffffff);
}

.dark-left {
  background: linear-gradient(135deg, #1a1f2e 0%, #232938 100%);
}

.dark-right {
  background: var(--surface, #232938);
}

.principles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.principle {
  background: var(--surface, #232938);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
}

.principle h4 {
  color: var(--primary, #4a9e8e);
  margin-bottom: 12px;
}

.principle p {
  color: var(--text-secondary, #5a6c7d);
  line-height: 1.6;
}

/* 暗色模式覆盖 */
html.dark .theme-preview {
  background: var(--bg, #1a1f2e);
}

html.dark h1,
html.dark h2,
html.dark h3,
html.dark .color-name,
html.dark .principle h4 {
  color: var(--text, #e8edf3);
}

html.dark .color-code,
html.dark .principle p {
  color: var(--text-mute, #7d8694);
}

html.dark .principle {
  background: var(--surface, #232938);
  border-color: var(--border, rgba(255, 255, 255, 0.06));
}

html.dark .login-mock {
  box-shadow: var(--shadow-2, 0 8px 24px rgba(0, 0, 0, 0.4));
}
</style>