<template>
  <div ref="containerRef" class="monaco-editor-wrap" :style="{ height: heightStyle }"></div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
// 只注册用到的语言，避免打包全部 80+ 语言导致体积爆炸
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

// Monaco 仅在浏览器运行；web worker 必须按 label 提供
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  }
}

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'json' },
  readonly: { type: Boolean, default: false },
  height: { type: [String, Number], default: 300 },
  minimap: { type: Boolean, default: false },
  wordWrap: { type: String, default: 'on' }
})

const emit = defineEmits(['update:modelValue'])

const containerRef = ref(null)
const editorRef = shallowRef(null)
let themeObserver = null

const heightStyle = computed(() =>
  typeof props.height === 'number' ? props.height + 'px' : props.height
)

function currentTheme() {
  return document.documentElement.classList.contains('dark') ? 'sb-dark' : 'sb-light'
}

// 自定义 emerald 主题，刻意避免蓝字（黑底蓝字看不清的根因）
function defineThemes() {
  monaco.editor.defineTheme('sb-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'e5e5e5' },
      { token: 'string.key.json', foreground: '3ecf8e' },
      { token: 'string.value.json', foreground: '9ca3af' },
      { token: 'number', foreground: '3ecf8e' },
      { token: 'keyword.json', foreground: '5eead4' },
      { token: 'string', foreground: '34d399' },
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '9ca3af' },
      { token: 'type', foreground: '5eead4' },
      { token: 'identifier', foreground: 'e5e5e5' }
    ],
    colors: {
      'editor.background': '#1c1c1c',
      'editor.foreground': '#e5e5e5',
      'editorLineNumber.foreground': '#525252',
      'editorLineNumber.activeForeground': '#3ecf8e',
      'editor.lineHighlightBackground': '#262626',
      'editor.selectionBackground': '#3ecf8e33',
      'editorCursor.foreground': '#3ecf8e',
      'editorIndentGuide.background1': '#2a2a2a',
      'editorWidget.background': '#202020',
      'editorWidget.border': '#2a2a2a',
      'input.background': '#202020',
      'input.border': '#2a2a2a',
      'scrollbarSlider.background': '#3ecf8e33',
      'scrollbarSlider.hoverBackground': '#3ecf8e55'
    }
  })

  monaco.editor.defineTheme('sb-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '1c1c1c' },
      { token: 'string.key.json', foreground: '047857' },
      { token: 'string.value.json', foreground: '374151' },
      { token: 'number', foreground: '047857' },
      { token: 'keyword.json', foreground: '0f766e' },
      { token: 'string', foreground: '059669' },
      { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '6b7280' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1c1c1c',
      'editorLineNumber.foreground': '#cbd5e1',
      'editorLineNumber.activeForeground': '#3ecf8e',
      'editor.lineHighlightBackground': '#f1f5f4',
      'editor.selectionBackground': '#3ecf8e33',
      'editorCursor.foreground': '#3ecf8e',
      'editorIndentGuide.background1': '#e5e7eb',
      'scrollbarSlider.background': '#3ecf8e33'
    }
  })
}

onMounted(() => {
  defineThemes()
  const editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue || '',
    language: props.language,
    theme: currentTheme(),
    readOnly: props.readonly,
    automaticLayout: true,
    minimap: { enabled: props.minimap },
    wordWrap: props.wordWrap,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
    scrollBeyondLastLine: false,
    tabSize: 2,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    roundedSelection: true,
    padding: { top: 10, bottom: 10 },
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }
  })
  editorRef.value = editor

  editor.onDidChangeModelContent(() => {
    const val = editor.getValue()
    if (val !== props.modelValue) emit('update:modelValue', val)
  })

  // 跟随顶栏/侧边栏的亮暗切换开关
  themeObserver = new MutationObserver(() => {
    monaco.editor.setTheme(currentTheme())
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

// 外部值变化（如"格式化"按钮）同步回编辑器
watch(
  () => props.modelValue,
  (val) => {
    const editor = editorRef.value
    if (editor && val !== editor.getValue()) {
      editor.setValue(val || '')
    }
  }
)

watch(
  () => props.readonly,
  (val) => editorRef.value?.updateOptions({ readOnly: val })
)

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  editorRef.value?.dispose()
})
</script>

<style scoped>
.monaco-editor-wrap {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--sb-border, #2a2a2a);
}
:deep(.monaco-editor),
:deep(.monaco-editor .overflow-guard) {
  border-radius: 8px;
}
</style>
