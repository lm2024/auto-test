<template>
  <div ref="containerRef" class="monaco-editor-wrap" :style="{ height: heightStyle }"></div>
</template>

<script>
// Monaco 仅在浏览器运行；web worker 必须按 label 提供
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      // JSON worker 需要通过 script 标签引入，这里使用默认方式
      return new (require('monaco-editor/esm/vs/language/json/json.worker'))()
    }
    return new (require('monaco-editor/esm/vs/editor/editor.worker'))()
  }
}

const monaco = require('monaco-editor/esm/vs/editor/editor.api')
require('monaco-editor/esm/vs/language/json/monaco.contribution')
require('monaco-editor/esm/vs/basic-languages/shell/shell.contribution')

export default {
  name: 'MonacoEditor',
  model: {
    prop: 'modelValue',
    event: 'update:modelValue'
  },
  props: {
    modelValue: { type: String, default: '' },
    language: { type: String, default: 'json' },
    readonly: { type: Boolean, default: false },
    height: { type: [String, Number], default: 300 },
    minimap: { type: Boolean, default: false },
    wordWrap: { type: String, default: 'on' }
  },
  data() {
    return {
      editorRef: null,
      themeObserver: null
    }
  },
  computed: {
    heightStyle() {
      return typeof this.height === 'number' ? this.height + 'px' : this.height
    }
  },
  watch: {
    modelValue(val) {
      const editor = this.editorRef
      if (editor && val !== editor.getValue()) {
        editor.setValue(val || '')
      }
    },
    readonly(val) {
      if (this.editorRef) {
        this.editorRef.updateOptions({ readOnly: val })
      }
    }
  },
  mounted() {
    if (typeof window === 'undefined') return
    this.defineThemes()
    const editor = monaco.editor.create(this.$refs.containerRef, {
      value: this.modelValue || '',
      language: this.language,
      theme: this.currentTheme(),
      readOnly: this.readonly,
      automaticLayout: true,
      minimap: { enabled: this.minimap },
      wordWrap: this.wordWrap,
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
    this.editorRef = editor

    var self = this
    editor.onDidChangeModelContent(function() {
      var val = editor.getValue()
      if (val !== self.modelValue) {
        self.$emit('update:modelValue', val)
      }
    })

    // 跟随顶栏/侧边栏的亮暗切换开关
    this.themeObserver = new MutationObserver(function() {
      monaco.editor.setTheme(self.currentTheme())
    })
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
  },
  beforeDestroy() {
    if (this.themeObserver) {
      this.themeObserver.disconnect()
    }
    if (this.editorRef) {
      this.editorRef.dispose()
    }
  },
  methods: {
    currentTheme() {
      return document.documentElement.classList.contains('dark') ? 'sb-dark' : 'sb-light'
    },
    defineThemes() {
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
  }
}
</script>

<style scoped>
.monaco-editor-wrap {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--sb-border, #2a2a2a);
}
::v-deep(.monaco-editor),
::v-deep(.monaco-editor .overflow-guard) {
  border-radius: 8px;
}
</style>
