#!/usr/bin/env node

/**
 * 全面修复暗色主题文本颜色问题
 * 确保所有组件在暗色模式下使用浅色文本
 */

const fs = require('fs');
const path = require('path');

// 需要检查的目录
const srcDir = path.join(__dirname, 'src');

// 暗色模式下应该使用的颜色
const darkModeColors = {
  // 文本颜色
  '#1c1c1c': '#e8edf3',  // 深黑 → 柔和白
  '#2c3e50': '#e8edf3',  // 深蓝灰 → 柔和白
  '#0a0a0a': '#ffffff',  // 近黑 → 纯白
  '#333333': '#e8edf3',  // 深灰 → 柔和白
  
  // 次级文本颜色
  '#3f3f46': '#b0b8c4',  // 次级文本 → 次级柔和白
  '#6b7280': '#7d8694',  // 辅助文本 → 暗色辅助文本
  
  // 背景色
  '#ffffff': '#232938',  // 纯白 → 暗色表面
  '#f8f9fa': '#1a1f2e',  // 柔和灰白 → 暗色背景
  
  // 绿色变体
  '#3ecf8e': '#5db8a7',  // 原绿色 → 蓝绿色
  '#4ade80': '#6dc4b4',  // 亮绿色 → 更亮的蓝绿色
  '#24b47e': '#4a9e8e',  // 深绿色 → 蓝绿色
};

function fixDarkModeColors(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    let changes = [];

    // 为每个颜色创建修复规则
    for (const [lightColor, darkColor] of Object.entries(darkModeColors)) {
      // 查找所有使用该颜色的地方
      const regex = new RegExp(lightColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      
      if (regex.test(content)) {
        // 检查是否已经在html.dark规则中
        const lines = content.split('\n');
        let inDarkMode = false;
        let fixedContent = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // 检测是否进入暗色模式规则
          if (line.includes('html.dark') || line.includes('.dark')) {
            inDarkMode = true;
          }
          
          // 如果在暗色模式规则中，替换颜色
          if (inDarkMode && line.includes(lightColor)) {
            const newLine = line.replace(lightColor, darkColor);
            fixedContent.push(newLine);
            changes.push(`行${i+1}: ${lightColor} → ${darkColor}`);
            changed = true;
          } else {
            fixedContent.push(line);
          }
        }
        
        if (changed) {
          content = fixedContent.join('\n');
        }
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ 修复文件: ${filePath}`);
      changes.forEach(change => console.log(`  - ${change}`));
    }
  } catch (error) {
    console.error(`✗ 处理文件失败: ${filePath}`, error.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (/\.(vue|css|scss|less)$/.test(file)) {
      fixDarkModeColors(filePath);
    }
  });
}

console.log('开始全面修复暗色主题颜色问题...');
console.log('-----------------------------------');

// 修复所有源文件
walkDir(srcDir);

console.log('-----------------------------------');
console.log('修复完成！');
console.log('');
console.log('说明：');
console.log('1. 修复了在html.dark规则中的硬编码颜色');
console.log('2. 确保暗色模式下使用正确的浅色文本');
console.log('3. 请重新启动开发服务器查看效果');