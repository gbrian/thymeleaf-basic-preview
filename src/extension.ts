import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'thymeleaf-preview.openPreview',
    () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showErrorMessage('No active HTML file found.')
        return
      }

      const htmlFilePath = editor.document.fileName

      if (!htmlFilePath.endsWith('.html')) {
        vscode.window.showErrorMessage('Active file is not an HTML file.')
        return
      }

      const basePath = htmlFilePath.replace(/\.html$/, '')
      const jsonFilePath = `${basePath}.json`
      const propertiesFilePath = `${basePath}.properties`

      // --- Open WebView panel ---
      const panel = vscode.window.createWebviewPanel(
        'thymeleafPreview',
        `Preview: ${path.basename(htmlFilePath)}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots: []
        }
      )

      const renderPreview = (): void => {
        // --- Load JSON data ---
        let data: Record<string, unknown> = {}
        if (fs.existsSync(jsonFilePath)) {
          try {
            const raw = fs.readFileSync(jsonFilePath, 'utf-8')
            data = JSON.parse(raw)
          } catch (e) {
            vscode.window.showWarningMessage(
              `Could not parse JSON file: ${jsonFilePath}. Using empty data.`
            )
          }
        }

        // --- Load .properties i18n ---
        const i18n = loadProperties(propertiesFilePath)

        // --- Read HTML template ---
        const openDoc = vscode.workspace.textDocuments.find(
          (d) => d.fileName === htmlFilePath
        )
        const rawHtml = openDoc
          ? openDoc.getText()
          : fs.existsSync(htmlFilePath)
            ? fs.readFileSync(htmlFilePath, 'utf-8')
            : ''

        // --- Process template ---
        const processedHtml = processThymeleaf(rawHtml, data, i18n)

        panel.webview.html = wrapWithToolbar(
          processedHtml,
          path.basename(htmlFilePath)
        )
      }

      // Initial render
      renderPreview()

      // --- File watchers ---
      const watchedFiles = [htmlFilePath, jsonFilePath, propertiesFilePath]
      const fileWatchers: fs.FSWatcher[] = watchedFiles.map((filePath) =>
        fs.watch(filePath, { persistent: false }, (_event: string) => {
          renderPreview()
        })
      )

      // Watch unsaved changes in the editor for the HTML file
      const onDidChangeDoc = vscode.workspace.onDidChangeTextDocument(
        (e: vscode.TextDocumentChangeEvent) => {
          if (e.document.fileName === htmlFilePath) {
            renderPreview()
          }
        }
      )

      // Cleanup on panel close
      panel.onDidDispose(() => {
        fileWatchers.forEach((w) => w.close())
        onDidChangeDoc.dispose()
      })
    }
  )

  context.subscriptions.push(command)
}

export function deactivate(): void {}

// ---------------------------------------------------------------------------
// Properties loader
// ---------------------------------------------------------------------------
function loadProperties(filePath: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!fs.existsSync(filePath)) {
    return result
  }

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) {
      continue
    }
    const key = trimmed.substring(0, eqIndex).trim()
    const value = trimmed.substring(eqIndex + 1).trim()
    result[key] = value
  }

  return result
}

// ---------------------------------------------------------------------------
// Core Thymeleaf processor
// ---------------------------------------------------------------------------
function processThymeleaf(
  html: string,
  data: Record<string, unknown>,
  i18n: Record<string, string>
): string {
  // Step 1: strip xmlns:th declaration (cosmetic)
  html = html.replace(/\s*xmlns:th="[^"]*"/g, '')

  // Step 3: resolve th:text attributes
  html = html.replace(
    /(<[^>]+)\s+th:text="([^"]*)"([^>]*>)([^<]*)/g,
    (_match: string, openTagStart: string, thExpr: string, openTagEnd: string, _originalContent: string) => {
      const resolved = resolveExpression(thExpr, data, i18n)
      return `${openTagStart}${openTagEnd}${escapeHtml(resolved)}`
    }
  )

  // Step 4: resolve inline ${...} expressions in text nodes and attributes
  html = html.replace(/\$\{([^}]+)\}/g, (_match: string, varName: string) => {
    return escapeHtml(String(resolveVar(varName.trim(), data)))
  })

  // Step 5: resolve remaining #{...} i18n keys in text
  html = html.replace(/#\{([^}]+)\}/g, (_match: string, key: string) => {
    return escapeHtml(i18n[key.trim()] ?? key.trim())
  })

  return html
}

// ---------------------------------------------------------------------------
// Expression resolver
// ---------------------------------------------------------------------------
function resolveExpression(
  expr: string,
  data: Record<string, unknown>,
  i18n: Record<string, string>
): string {
  expr = expr.trim()

  const i18nMatch = expr.match(/^#\{([^}]+)\}$/)
  if (i18nMatch) {
    const key = i18nMatch[1]
    return i18n[key] ?? key
  }

  const varMatch = expr.match(/^\$\{([^}]+)\}$/)
  if (varMatch) {
    return String(resolveVar(varMatch[1].trim(), data))
  }

  if (expr.startsWith('|') && expr.endsWith('|')) {
    const inner = expr.slice(1, -1)
    return inner.replace(/\$\{([^}]+)\}/g, (_m: string, v: string) =>
      String(resolveVar(v.trim(), data))
    )
  }

  const parts = splitConcatExpression(expr)
  return parts
    .map((part: string) => {
      part = part.trim()
      if (part.startsWith("'") && part.endsWith("'")) {
        return part.slice(1, -1)
      }
      const vMatch = part.match(/^\$\{([^}]+)\}$/)
      if (vMatch) {
        return String(resolveVar(vMatch[1].trim(), data))
      }
      const iMatch = part.match(/^#\{([^}]+)\}$/)
      if (iMatch) {
        return i18n[iMatch[1]] ?? iMatch[1]
      }
      return part
    })
    .join('')
}

// ---------------------------------------------------------------------------
// Split a Thymeleaf concatenation expression on `+`
// ---------------------------------------------------------------------------
function splitConcatExpression(expr: string): string[] {
  const parts: string[] = []
  let current = ''
  let i = 0

  while (i < expr.length) {
    const ch = expr[i]

    if (ch === "'") {
      current += ch
      i++
      while (i < expr.length && expr[i] !== "'") {
        current += expr[i]
        i++
      }
      if (i < expr.length) {
        current += expr[i]
        i++
      }
    } else if (ch === '$' && expr[i + 1] === '{') {
      current += ch
      i++
      while (i < expr.length && expr[i] !== '}') {
        current += expr[i]
        i++
      }
      if (i < expr.length) {
        current += expr[i]
        i++
      }
    } else if (ch === '+') {
      parts.push(current)
      current = ''
      i++
    } else {
      current += ch
      i++
    }
  }

  if (current.trim()) {
    parts.push(current)
  }

  return parts
}

// ---------------------------------------------------------------------------
// Variable resolver — supports dot notation: ${user.name}
// ---------------------------------------------------------------------------
function resolveVar(varPath: string, data: Record<string, unknown>): unknown {
  const keys = varPath.split('.')
  let current: unknown = data
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return `{{${varPath}}}`
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current ?? `{{${varPath}}}`
}

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Wrap the processed HTML with a small dev toolbar
// ---------------------------------------------------------------------------
function wrapWithToolbar(html: string, filename: string): string {
  const toolbar = `
  <div style="
    position: fixed;
    top: 0; left: 0; right: 0;
    background: #1e1e2e;
    color: #cdd6f4;
    font-family: monospace;
    font-size: 12px;
    padding: 4px 12px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 2px solid #89b4fa;
  ">
    <span style="color:#89b4fa;font-weight:bold;">🌿 Thymeleaf Preview</span>
    <span style="color:#a6adc8;">${filename}</span>
    <span style="
      margin-left: auto;
      background:#f38ba8;
      color:#1e1e2e;
      border-radius:4px;
      padding:1px 6px;
      font-weight:bold;
    ">DEV</span>
  </div>
  <div style="height:28px;"></div>`

  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${toolbar}`)
  }
  if (html.includes('<body')) {
    return html.replace(/(<body[^>]*>)/, `$1${toolbar}`)
  }
  return toolbar + html
}