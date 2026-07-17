import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as cp from 'child_process'

let outputChannel: vscode.OutputChannel

function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Thymeleaf Preview')
	}
	return outputChannel
}

function log(message: string): void {
	const channel = getOutputChannel()
	const timestamp = new Date().toISOString()
	channel.appendLine(`[${timestamp}] ${message}`)
}

function logError(message: string, error?: unknown): void {
	const channel = getOutputChannel()
	const timestamp = new Date().toISOString()
	channel.appendLine(`[${timestamp}] ❌ ERROR: ${message}`)
	if (error instanceof Error) {
		channel.appendLine(`[${timestamp}]    ${error.message}`)
		if (error.stack) {
			channel.appendLine(`[${timestamp}]    ${error.stack}`)
		}
	} else if (error !== undefined) {
		channel.appendLine(`[${timestamp}]    ${String(error)}`)
	}
	channel.show(true)
}

export function activate(context: vscode.ExtensionContext): void {
	log('Thymeleaf Preview extension activated')

	const command = vscode.commands.registerCommand(
		'thymeleaf-preview.openPreview',
		(): void => {
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				vscode.window.showErrorMessage('No active HTML file found.')
				log('Command triggered but no active editor found')
				return
			}

			const htmlFilePath = editor.document.fileName
			log(`Opening preview for: ${htmlFilePath}`)

			if (!htmlFilePath.endsWith('.html')) {
				vscode.window.showErrorMessage('Active file is not an HTML file.')
				log(`File rejected — not an HTML file: ${htmlFilePath}`)
				return
			}

			const basePath = htmlFilePath.replace(/\.html$/, '')
			const jsonFilePath = `${basePath}.json`
			const propertiesFilePath = `${basePath}.properties`

			log(`Resolved paths — JSON: ${jsonFilePath} | Properties: ${propertiesFilePath}`)

			const panel = vscode.window.createWebviewPanel(
				'thymeleafPreview',
				`Preview: ${path.basename(htmlFilePath)}`,
				vscode.ViewColumn.Beside,
				{
					enableScripts: false,
					localResourceRoots: []
				}
			)

			const jarPath = context.asAbsolutePath(path.join('bin', 'thymeleaf-cli.jar'))
			log(`JAR path resolved: ${jarPath}`)

			const renderPreview = (): void => {
				log(`Rendering preview for: ${path.basename(htmlFilePath)}`)

				let data: Record<string, unknown> = {}

				if (fs.existsSync(jsonFilePath)) {
					log(`JSON data file found: ${jsonFilePath}`)
					try {
						const raw = fs.readFileSync(jsonFilePath, 'utf-8')
						data = JSON.parse(raw)
						log(`JSON parsed successfully — keys: ${Object.keys(data).join(', ')}`)
					} catch (parseError) {
						logError(`Could not parse JSON file: ${jsonFilePath}`, parseError)
						vscode.window.showWarningMessage(
							`Could not parse JSON file: ${jsonFilePath}. Using empty data.`
						)
					}
				} else {
					log(`No JSON data file found at: ${jsonFilePath} — using empty data`)
				}

				const jarExists = fs.existsSync(jarPath)
				const jsonExists = fs.existsSync(jsonFilePath)

				log(`JAR exists: ${jarExists} | JSON exists: ${jsonExists}`)

				if (jarExists && jsonExists) {
					log('Using Java CLI engine (Thymeleaf)')
					renderViaJavaCli(panel, htmlFilePath, jsonFilePath, propertiesFilePath, jarPath)
				} else {
					if (!jarExists) {
						log('JAR not found — falling back to JS processor')
					}
					if (!jsonExists) {
						log('JSON file not found — falling back to JS processor')
					}
					renderViaJsProcessor(panel, htmlFilePath, jsonFilePath, propertiesFilePath, data)
				}
			}

			renderPreview()

			const fsWatcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(
					vscode.Uri.file(path.dirname(htmlFilePath)),
					`${path.basename(basePath)}.{html,json,properties}`
				),
				false,
				false,
				true
			)

			fsWatcher.onDidChange((uri: vscode.Uri): void => {
				log(`File changed (external): ${uri.fsPath}`)
				renderPreview()
			})

			fsWatcher.onDidCreate((uri: vscode.Uri): void => {
				log(`File created (external): ${uri.fsPath}`)
				renderPreview()
			})

			const onDidChangeDoc = vscode.workspace.onDidChangeTextDocument(
				(e: vscode.TextDocumentChangeEvent): void => {
					if (e.document.fileName === htmlFilePath) {
						log(`Document changed in editor: ${path.basename(htmlFilePath)}`)
						renderPreview()
					}
				}
			)

			panel.onDidDispose((): void => {
				log(`Preview panel closed for: ${path.basename(htmlFilePath)}`)
				fsWatcher.dispose()
				onDidChangeDoc.dispose()
			})
		}
	)

	context.subscriptions.push(command)
}

export function deactivate(): void {
	log('Thymeleaf Preview extension deactivated')
}

function renderViaJavaCli(
	panel: vscode.WebviewPanel,
	htmlFilePath: string,
	jsonFilePath: string,
	propertiesFilePath: string,
	jarPath: string
): void {
	const args: string[] = [
		'-jar', jarPath,
		'--template-path', htmlFilePath,
		'--data-path', jsonFilePath
	]

	if (fs.existsSync(propertiesFilePath)) {
		log(`Messages file found at: ${propertiesFilePath}`)
		args.push('--messages-path', propertiesFilePath)
	} else {
		log(`No messages file found at: ${propertiesFilePath}`)
	}

	log(`Spawning Java process — args: ${args.join(' ')}`)

	cp.execFile('java', args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (
		err: cp.ExecFileException | null,
		stdout: string,
		stderr: string
	): void => {
		if (err) {
			const fullError = combinedErrorOutput(stderr, stdout)
			const displayError = extractErrorDetails(fullError)
			logError(`Java CLI process failed for: ${path.basename(htmlFilePath)}`, fullError)
			vscode.window.showErrorMessage(`Thymeleaf CLI error: Check output channel for details`)
			panel.webview.html = wrapWithToolbar(
				buildErrorPanel('Java Processing Failed', displayError, htmlFilePath, jsonFilePath),
				path.basename(htmlFilePath),
				'java'
			)
			return
		}

		if (stderr) {
			log(`Java CLI stderr (non-fatal): ${stderr}`)
		}

		log(`Java CLI completed successfully — output length: ${stdout.length} chars`)
		panel.webview.html = wrapWithToolbar(stdout, path.basename(htmlFilePath), 'java')
	})
}

function combinedErrorOutput(stderr: string, stdout: string): string {
	if (stderr && stdout) {
		return `${stderr}\n\n${stdout}`
	}
	return stderr || stdout
}

function extractErrorDetails(fullError: string): string {
	const lines = fullError.split('\n').filter((line: string): boolean => line.trim().length > 0)

	const errorDetailsStart = lines.findIndex(
		(line: string): boolean => line.includes('ERROR DETAILS:') || line.includes('Error')
	)

	if (errorDetailsStart !== -1) {
		return lines.slice(errorDetailsStart).join('\n')
	}

	const relevantLines = lines.filter((line: string): boolean =>
		line.includes('Error') ||
		line.includes('Exception') ||
		line.includes('Template') ||
		line.includes('parsing') ||
		line.includes('Cause') ||
		line.includes('Type:')
	)

	if (relevantLines.length > 0) {
		return relevantLines.join('\n')
	}

	return lines.slice(-15).join('\n')
}

function renderViaJsProcessor(
	panel: vscode.WebviewPanel,
	htmlFilePath: string,
	jsonFilePath: string,
	propertiesFilePath: string,
	data: Record<string, unknown>
): void {
	log('Starting JS fallback processor')

	const i18n = loadProperties(propertiesFilePath)
	log(`i18n keys loaded: ${Object.keys(i18n).length}`)

	const openDoc = vscode.workspace.textDocuments.find(
		(d: vscode.TextDocument): boolean => d.fileName === htmlFilePath
	)

	const rawHtml = openDoc
		? openDoc.getText()
		: fs.existsSync(htmlFilePath)
			? fs.readFileSync(htmlFilePath, 'utf-8')
			: ''

	log(`HTML source: ${openDoc ? 'editor buffer' : 'file on disk'} — length: ${rawHtml.length} chars`)

	try {
		const processedHtml = processThymeleaf(rawHtml, data, i18n)
		log(`JS processing complete — output length: ${processedHtml.length} chars`)
		panel.webview.html = wrapWithToolbar(processedHtml, path.basename(htmlFilePath), 'js')
	} catch (processingError) {
		logError(`JS processor failed for: ${path.basename(htmlFilePath)}`, processingError)
		const errorMessage = processingError instanceof Error
			? processingError.message
			: String(processingError)
		panel.webview.html = wrapWithToolbar(
			buildErrorPanel('JS Processing Failed', errorMessage, htmlFilePath, jsonFilePath),
			path.basename(htmlFilePath),
			'js'
		)
	}
}

function buildErrorPanel(
	title: string,
	errorMessage: string,
	htmlFilePath: string,
	jsonFilePath: string
): string {
	const formattedError = errorMessage
		.split('\n')
		.map((line: string): string => escapeHtml(line))
		.join('\n')

	return `
    <div style="
      font-family: monospace;
      padding: 2em;
      background: #1e1e2e;
      color: #cdd6f4;
      min-height: 100vh;
      box-sizing: border-box;
    ">
      <h2 style="color:#f38ba8;margin-top:0;">⚠️ ${escapeHtml(title)}</h2>
      <p style="color:#a6adc8;margin-bottom:1.5em;">
        An error occurred while processing the Thymeleaf template.
        <br/>
        <strong style="color:#89b4fa;">👉 Check the <strong>Thymeleaf Preview</strong> output channel for the complete stack trace.</strong>
      </p>
      <div style="
        background:#181825;
        border:1px solid #f38ba8;
        border-radius:6px;
        padding:1em 1.2em;
        color:#f38ba8;
        white-space:pre-wrap;
        word-break:break-word;
        line-height:1.6;
        max-height: 500px;
        overflow-y: auto;
        font-size: 11px;
      "><strong>Error Details:</strong>
${formattedError}</div>
      <div style="margin-top:1.5em;color:#6c7086;font-size:0.85em;">
        <div><span style="color:#a6adc8;">Template:</span> ${escapeHtml(htmlFilePath)}</div>
        <div><span style="color:#a6adc8;">Data:</span>     ${escapeHtml(jsonFilePath)}</div>
      </div>
      <div style="margin-top:2em;padding-top:1.5em;border-top:1px solid #45475a;color:#89b4fa;font-size:0.9em;">
        <strong>Troubleshooting Tips:</strong>
        <ul style="margin:0.5em 0;">
          <li>Verify JSON syntax is valid using a JSON validator</li>
          <li>Check template variable names match data keys exactly</li>
          <li>Ensure both template and data files are readable</li>
          <li>Review the full output channel logs for stack trace details</li>
          <li>Confirm Thymeleaf syntax follows the specification</li>
        </ul>
      </div>
    </div>
  `
}

function loadProperties(filePath: string): Record<string, string> {
	const result: Record<string, string> = {}
	if (!fs.existsSync(filePath)) {
		log(`No properties file found at: ${filePath}`)
		return result
	}

	log(`Loading properties from: ${filePath}`)
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

function processThymeleaf(
	html: string,
	data: Record<string, unknown>,
	i18n: Record<string, string>
): string {
	html = html.replace(/\s*xmlns:th="[^"]*"/g, '')
	html = processEachLoops(html, data, i18n)
	html = html.replace(
		/(<[^>]+)\s+th:text="([^"]*)"([^>]*>)([^<]*)/g,
		(match: string, openTagStart: string, thExpr: string, openTagEnd: string, originalContent: string): string => {
			const resolved = resolveExpression(thExpr, data, i18n)
			return `${openTagStart}${openTagEnd}${escapeHtml(resolved)}`
		}
	)
	html = processClassAppend(html, data, i18n)
	html = html.replace(/\$\{([^}]+)\}/g, (match: string, varName: string): string => {
		return escapeHtml(String(resolveVar(varName.trim(), data, i18n)))
	})
	html = html.replace(/#\{([^}]+)\}/g, (match: string, key: string): string => {
		return escapeHtml(i18n[key.trim()] ?? key.trim())
	})
	return html
}

function processEachLoops(
	html: string,
	data: Record<string, unknown>,
	i18n: Record<string, string>
): string {
	const eachTagPattern = /<([a-zA-Z][a-zA-Z0-9]*)((?:[^>](?!th:each))*?)\s+th:each="([^"]+)"(?:[^>]*?)>([\s\S]*?)<\/\1>/g

	return html.replace(
		eachTagPattern,
		(
			match: string,
			tagName: string,
			attrsBefore: string,
			eachExpr: string,
			attrsAfter: string,
			innerContent: string
		): string => {
			const eachMatch = eachExpr.trim().match(/^(\w+)(?:\s*,\s*(\w+))?\s*:\s*\$\{([^}]+)\}$/)
			if (!eachMatch) {
				return match
			}

			const iterVar = eachMatch[1]
			const statusVar = eachMatch[2] ?? null
			const listPath = eachMatch[3].trim()
			const listValue = resolveVar(listPath, data, i18n)

			if (!Array.isArray(listValue)) {
				return `<${tagName}${attrsBefore}${attrsAfter}>${innerContent}</${tagName}>`
			}

			return listValue
				.map((item: unknown, index: number): string => {
					const iterStatus: Record<string, unknown> = {
						index,
						count: index + 1,
						size: listValue.length,
						current: item,
						even: index % 2 === 0,
						odd: index % 2 !== 0,
						first: index === 0,
						last: index === listValue.length - 1
					}

					const scopedData: Record<string, unknown> = {
						...data,
						[iterVar]: item,
						...(statusVar ? { [statusVar]: iterStatus } : {})
					}

					const processedInner = processThymeleafScoped(innerContent, scopedData, i18n)
					return `<${tagName}${attrsBefore}${attrsAfter}>${processedInner}</${tagName}>`
				})
				.join('\n')
		}
	)
}

function processThymeleafScoped(
	html: string,
	data: Record<string, unknown>,
	i18n: Record<string, string>
): string {
	html = html.replace(
		/(<[^>]+)\s+th:text="([^"]*)"([^>]*>)([^<]*)/g,
		(match: string, openTagStart: string, thExpr: string, openTagEnd: string, originalContent: string): string => {
			const resolved = resolveExpression(thExpr, data, i18n)
			return `${openTagStart}${openTagEnd}${escapeHtml(resolved)}`
		}
	)
	html = processClassAppend(html, data, i18n)
	html = html.replace(/\$\{([^}]+)\}/g, (match: string, varName: string): string => {
		return escapeHtml(String(resolveVar(varName.trim(), data, i18n)))
	})
	html = html.replace(/#\{([^}]+)\}/g, (match: string, key: string): string => {
		return escapeHtml(i18n[key.trim()] ?? key.trim())
	})
	return html
}

function processClassAppend(
	html: string,
	data: Record<string, unknown>,
	i18n: Record<string, string>
): string {
	return html.replace(
		/(<[a-zA-Z][a-zA-Z0-9]*(?:[^>]*?))(\s+class="([^"]*)")?((?:[^>]*?)\s+th:classappend="([^"]*)")((?:[^>]*?)>)/g,
		(
			match: string,
			tagStart: string,
			existingClassAttr: string,
			existingClass: string,
			thClassAppendAttr: string,
			appendExpr: string,
			tagEnd: string
		): string => {
			const appended = resolveExpression(appendExpr, data, i18n)
			const base = existingClass ? existingClass.trim() : ''
			const newClass = base ? `${base} ${appended}` : appended
			if (existingClassAttr) {
				return `${tagStart} class="${newClass}"${tagEnd}`
			}
			return `${tagStart} class="${newClass}"${tagEnd}`
		}
	)
}

function resolveMessagesMsg(
	argsExpr: string,
	data: Record<string, unknown>,
	i18n: Record<string, string>
): string {
	const key = resolveMessagesMsgKey(argsExpr.trim(), data)
	return i18n[key] ?? key
}

function resolveMessagesMsgKey(
	expr: string,
	data: Record<string, unknown>
): string {
	const parts = splitConcatExpression(expr)
	return parts
		.map((part: string): string => {
			part = part.trim()
			if (part.startsWith("'") && part.endsWith("'")) {
				return part.slice(1, -1)
			}
			const vMatch = part.match(/^\$\{([^}]+)\}$/)
			if (vMatch) {
				return String(resolveVar(vMatch[1].trim(), data, {}))
			}
			if (part.length > 0) {
				return String(resolveVar(part, data, {}))
			}
			return part
		})
		.join('')
}

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

	const msgMatch = expr.match(/^\$\{#messages\.msg\(([^)]+)\)\}$/)
	if (msgMatch) {
		return resolveMessagesMsg(msgMatch[1], data, i18n)
	}

	const varMatch = expr.match(/^\$\{([^}]+)\}$/)
	if (varMatch) {
		return String(resolveVar(varMatch[1].trim(), data, i18n))
	}

	if (expr.startsWith('|') && expr.endsWith('|')) {
		const inner = expr.slice(1, -1)
		return inner.replace(/\$\{([^}]+)\}/g, (m: string, v: string): string =>
			String(resolveVar(v.trim(), data, i18n))
		)
	}

	const parts = splitConcatExpression(expr)
	return parts
		.map((part: string): string => {
			part = part.trim()
			if (part.startsWith("'") && part.endsWith("'")) {
				const inner = part.slice(1, -1)
				return inner.replace(/\$\{([^}]+)\}/g, (m: string, v: string): string =>
					String(resolveVar(v.trim(), data, i18n))
				)
			}
			const vMatch = part.match(/^\$\{([^}]+)\}$/)
			if (vMatch) {
				return String(resolveVar(vMatch[1].trim(), data, i18n))
			}
			const iMatch = part.match(/^#\{([^}]+)\}$/)
			if (iMatch) {
				return i18n[iMatch[1]] ?? iMatch[1]
			}
			return part
		})
		.join('')
}

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

function resolveVar(
	varPath: string,
	data: Record<string, unknown>,
	i18n: Record<string, string>
): unknown {
	const msgMatch = varPath.match(/^#messages\.msg\(([^)]+)\)$/)
	if (msgMatch) {
		return resolveMessagesMsg(msgMatch[1], data, i18n)
	}

	const methodMatch = varPath.match(/^(.+)\.(\w+)\(\)$/)
	if (methodMatch) {
		const objectPath = methodMatch[1]
		const methodName = methodMatch[2]
		const target = resolveVar(objectPath, data, i18n)

		if (Array.isArray(target)) {
			if (methodName === 'size' || methodName === 'length') {
				return target.length
			}
			if (methodName === 'isEmpty') {
				return target.length === 0
			}
		}

		if (typeof target === 'string') {
			if (methodName === 'length') {
				return target.length
			}
			if (methodName === 'isEmpty') {
				return target.length === 0
			}
			if (methodName === 'toUpperCase') {
				return target.toUpperCase()
			}
			if (methodName === 'toLowerCase') {
				return target.toLowerCase()
			}
			if (methodName === 'trim') {
				return target.trim()
			}
		}

		return `{{${varPath}}}`
	}

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

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function wrapWithToolbar(
	html: string,
	filename: string,
	engine: 'java' | 'js'
): string {
	const engineLabel = engine === 'java'
		? `<span style="background:#a6e3a1;color:#1e1e2e;border-radius:4px;padding:1px 6px;font-weight:bold;margin-left:6px;">☕ Java</span>`
		: `<span style="background:#f9e2af;color:#1e1e2e;border-radius:4px;padding:1px 6px;font-weight:bold;margin-left:6px;">🟨 JS Fallback</span>`

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
    ${engineLabel}
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