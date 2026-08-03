#!/usr/bin/env node

/**
 * 修复暗色主题文本颜色问题
 * 确保所有组件在暗色模式下使用浅色文本
 */

const fs = require('fs');
const path = require('path');

// 需要检查的目录
const srcDir = path.join(__dirname, 'src');

// 旧的CSS变量映射到新的CSS变量
const oldToNewMapping = {
  '--sb-text': '--text',
  '--sb-text-secondary': '--text-secondary',
  '--sb-text-mute': '--text-mute',
  '--sb-text-disabled': '--text-disabled',
  '--sb-bg': '--bg',
  '--sb-surface': '--surface',
  '--sb-surface-2': '--surface-2',
  '--sb-surface-3': '--surface-3',
  '--sb-green': '--primary',
  '--sb-green-soft': '--primary-light',
  '--sb-green-deep': '--primary-dark',
};

// 旧的CSS变量名（带--sb-前缀）
const oldVarNames = Object.keys(oldToNewMapping);

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 替换旧的CSS变量为新的CSS变量
    for (const [oldVar, newVar] of Object.entries(oldToNewMapping)) {
      const regex = new RegExp(oldVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (regex.test(content)) {
        content = content.replace(regex, newVar);
        changed = true;
        console.log(`  替换 ${oldVar} → ${newVar}`);
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ 修复文件: ${filePath}`);
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
    } else if (/\.(vue|css|scss|less|js|ts)$/.test(file)) {
      fixFile(filePath);
    }
  });
}

console.log('开始修复暗色主题文本颜色问题...');
console.log('-----------------------------------');

// 修复所有源文件
walkDir(srcDir);

console.log('-----------------------------------');
console.log('修复完成！');