# API文档生成器浏览器扩展

这是一个浏览器扩展，用于监听网页的网络请求并自动生成API文档。

## 功能特点

- 🎯 实时监听网络请求（fetch 和 XMLHttpRequest）
- 📝 自动生成结构化的API文档
- 💾 本地存储请求历史
- 🎨 美观的文档展示界面
- 🔍 支持多种HTTP方法（GET、POST、PUT、DELETE、PATCH等）

## 安装方法

1. 下载或克隆此项目到本地
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

## 使用方法

1. 打开需要监听API请求的网页
2. 点击浏览器工具栏中的扩展图标
3. 点击"开始录制"按钮
4. 在网页中进行操作，触发API请求
5. 点击"停止录制"按钮
6. 点击"生成文档"按钮，查看生成的API文档

## 文件结构

```
page-api/
├── manifest.json        # 扩展配置文件
├── background.js        # 后台脚本，处理网络请求监听
├── content.js          # 内容脚本，注入到页面中
├── inject.js           # 注入脚本，拦截网络请求
├── popup.html          # 弹出窗口界面
├── popup.js            # 弹出窗口逻辑
└── README.md           # 说明文档
```

## 技术实现

- 使用Chrome Extension API进行扩展开发
- 通过重写fetch和XMLHttpRequest拦截网络请求
- 使用Chrome Debugger API获取更详细的网络信息
- 采用现代化的UI设计，提供良好的用户体验

## 注意事项

- 扩展需要debugger权限来获取完整的网络请求信息
- 生成的文档会在新标签页中打开
- 请求历史会保存在本地存储中

## 兼容性

- Chrome 88+
- Edge 88+
- 其他基于Chromium的浏览器

## 许可证

MIT License