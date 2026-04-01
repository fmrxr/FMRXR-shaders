'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { EditorTabs } from './EditorTabs';
import { ErrorBar } from './ErrorBar';
import { clsx } from 'clsx';

// Lazy-load Monaco to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then(m => m.default),
  { ssr: false, loading: () => <EditorFallback /> }
);

export function ShaderEditor() {
  const { project, editor, updateBuffer, activeCode, activeBuffer } = useShaderStore();
  const monacoRef = useRef<any>(null);

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = { editor, monaco };

    // Register GLSL language
    monaco.languages.register({ id: 'glsl' });
    monaco.languages.setMonarchTokensProvider('glsl', glslTokenizer);
    monaco.editor.defineTheme('forge-dark', forgeDarkTheme);
    monaco.editor.setTheme('forge-dark');

    // GLSL autocompletion
    monaco.languages.registerCompletionItemProvider('glsl', {
      provideCompletionItems: (model: any, position: any) => ({
        suggestions: GLSL_COMPLETIONS.map(c => ({
          label: c.label,
          kind: monaco.languages.CompletionItemKind[c.kind],
          insertText: c.insertText,
          documentation: c.docs,
          insertTextRules: c.snippet
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
        })),
      }),
    });
  };

  const handleChange = useCallback((value?: string) => {
    if (value !== undefined) {
      updateBuffer(editor.activeBufferId, value);
    }
  }, [editor.activeBufferId, updateBuffer]);

  const activeError = editor.errors[editor.activeBufferId];
  const currentBuf = activeBuffer();

  return (
    <div className="flex flex-col h-full bg-forge-bg2">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          key={editor.activeBufferId}
          language="glsl"
          value={currentBuf?.code ?? ''}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            theme: 'forge-dark',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            fontLigatures: true,
            lineHeight: 21,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'line',
            cursorStyle: 'line',
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            glyphMargin: false,
            folding: true,
            lineNumbers: 'on',
            renderWhitespace: 'none',
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
      {activeError && <ErrorBar error={activeError} />}
    </div>
  );
}

function EditorFallback() {
  const { activeCode, editor, updateBuffer } = useShaderStore();
  const code = activeCode();

  return (
    <textarea
      value={code}
      onChange={e => updateBuffer(editor.activeBufferId, e.target.value)}
      className="w-full h-full bg-forge-bg2 text-forge-text font-mono text-sm p-4 resize-none outline-none border-none leading-relaxed"
      spellCheck={false}
      style={{ tabSize: 2 }}
    />
  );
}

// ─── Monaco GLSL theme ───────────────────────────────────────────────

const forgeDarkTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'keyword',       foreground: '6c63ff' },
    { token: 'type',          foreground: '00d9b8' },
    { token: 'builtin',       foreground: 'ff6b9d' },
    { token: 'number',        foreground: 'ffb830' },
    { token: 'comment',       foreground: '5a5a7a', fontStyle: 'italic' },
    { token: 'string',        foreground: '00ff88' },
    { token: 'function',      foreground: 'e8e8f0' },
  ],
  colors: {
    'editor.background':           '#0f0f13',
    'editor.foreground':           '#e8e8f0',
    'editorLineNumber.foreground': '#3a3a5a',
    'editorLineNumber.activeForeground': '#6c63ff',
    'editor.lineHighlightBackground': '#14141a',
    'editorCursor.foreground':     '#6c63ff',
    'editor.selectionBackground':  '#6c63ff33',
    'editorIndentGuide.background':'#ffffff10',
  },
};

// ─── GLSL monarch tokenizer ──────────────────────────────────────────

const glslTokenizer = {
  keywords: [
    'void','float','int','bool','vec2','vec3','vec4','mat2','mat3','mat4',
    'sampler2D','samplerCube','uniform','varying','attribute','in','out','inout',
    'const','precision','highp','mediump','lowp','return','if','else','for',
    'while','do','break','continue','discard','struct',
  ],
  builtins: [
    'sin','cos','tan','asin','acos','atan','sinh','cosh','tanh',
    'pow','exp','log','exp2','log2','sqrt','inversesqrt',
    'abs','sign','floor','ceil','round','fract','mod','min','max','clamp',
    'mix','step','smoothstep','length','distance','dot','cross','normalize',
    'reflect','refract','texture','texture2D','textureCube',
    'gl_FragCoord','gl_Position','gl_FragColor','iTime','iResolution',
    'iMouse','iFrame','iChannel0','iChannel1','iChannel2','iChannel3',
  ],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/\b(void|float|int|bool|vec[234]|mat[234]|sampler2D|samplerCube)\b/, 'type'],
      [/\b(uniform|varying|attribute|in|out|inout|const|precision|highp|mediump|lowp|return|if|else|for|while|do|break|continue|discard|struct)\b/, 'keyword'],
      [/\b(sin|cos|tan|asin|acos|atan|pow|exp|log|sqrt|abs|floor|ceil|fract|mod|min|max|clamp|mix|step|smoothstep|length|distance|dot|cross|normalize|reflect|refract|texture2D|textureCube|texture|gl_FragCoord|gl_Position|gl_FragColor|iTime|iResolution|iMouse|iFrame|iChannel[0-3])\b/, 'builtin'],
      [/[0-9]+\.[0-9]*([eE][-+]?[0-9]+)?/, 'number.float'],
      [/\.[0-9]+([eE][-+]?[0-9]+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/[0-9]+/, 'number'],
      [/[a-zA-Z_]\w*/, 'identifier'],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
  },
};

// ─── GLSL completions ────────────────────────────────────────────────

const GLSL_COMPLETIONS = [
  { label: 'void main()', kind: 'Function', insertText: 'void main() {\n  $0\n}', snippet: true, docs: 'Main shader entry point' },
  { label: 'uniform float', kind: 'Keyword', insertText: 'uniform float ${1:name};', snippet: true, docs: 'Float uniform' },
  { label: 'vec2', kind: 'Keyword', insertText: 'vec2(${1:x}, ${2:y})', snippet: true, docs: '2D vector' },
  { label: 'vec3', kind: 'Keyword', insertText: 'vec3(${1:x}, ${2:y}, ${3:z})', snippet: true, docs: '3D vector' },
  { label: 'vec4', kind: 'Keyword', insertText: 'vec4(${1:x}, ${2:y}, ${3:z}, ${4:w})', snippet: true, docs: '4D vector' },
  { label: 'smoothstep', kind: 'Function', insertText: 'smoothstep(${1:edge0}, ${2:edge1}, ${3:x})', snippet: true, docs: 'Smooth interpolation' },
  { label: 'mix', kind: 'Function', insertText: 'mix(${1:a}, ${2:b}, ${3:t})', snippet: true, docs: 'Linear interpolation' },
  { label: 'normalize', kind: 'Function', insertText: 'normalize(${1:v})', snippet: true, docs: 'Normalize vector' },
  { label: 'texture2D', kind: 'Function', insertText: 'texture2D(${1:sampler}, ${2:uv})', snippet: true, docs: 'Sample a 2D texture' },
  { label: 'gl_FragColor', kind: 'Variable', insertText: 'gl_FragColor', snippet: false, docs: 'Output fragment color' },
  { label: 'gl_FragCoord', kind: 'Variable', insertText: 'gl_FragCoord', snippet: false, docs: 'Fragment screen coords' },
  { label: 'iTime', kind: 'Variable', insertText: 'iTime', snippet: false, docs: 'Elapsed time in seconds' },
  { label: 'iResolution', kind: 'Variable', insertText: 'iResolution', snippet: false, docs: 'Canvas resolution' },
  { label: 'iMouse', kind: 'Variable', insertText: 'iMouse', snippet: false, docs: 'Mouse position' },
];
