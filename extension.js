const vscode = require('vscode');
const ChatGPT = require('./ChatGPT');
const { removeAllPassword, resetAll, resetPromptsHistory } = require('./storageManager');
const MASKING = '****';
function makeReqForm(configName, text) {
	const activeEditor = vscode.window.activeTextEditor;
	const languageId = activeEditor.document.languageId;
	let content = bindingTemplate(getConfigValue(configName), { selectedcode: text, languageId, language: getConfigValue('language') });
	// content = content.split('```').join('');
	// content = content.split('\n').join(' ');
	content = content.trim();
	const system = `You are a ${languageId} coding expert assistant`;
	return { content, system };
}
async function setCurrentEditorContent(newContent) {
	const editor = vscode.window.activeTextEditor;
	const firstLine = editor.document.lineAt(0);
	const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
	const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
	await editor.edit(editBuilder => {
		editBuilder.replace(fullRange, newContent);
	});
}
function removeSelection() {
	if (!vscode.window.activeTextEditor) return;
	const editor = vscode.window.activeTextEditor;
	const startPosition = editor.selection.start;
	const newSelection = new vscode.Selection(startPosition, startPosition);
	editor.selection = newSelection;
}
async function showDiff(originalCode) {
	if (!getConfigValue('codeDiff')) return;
	await new Promise(r => setTimeout(r, 0));
	const editor = vscode.window.activeTextEditor;
	const leftContent = editor.document.getText();
	await setCurrentEditorContent(originalCode)
	if (leftContent === originalCode) {
		vscode.window.showInformationMessage('No change.');
		return;
	}
	const startTime = new Date()
	while (true) {
		if (leftContent !== editor.document.getText()) break;
		if (new Date() - startTime > 500) break;
		await new Promise(r => setTimeout(r, 32));
	}
	const rightUri = editor.document.uri;
	const title = '🤖 Change Review 😀';
	const leftUri = vscode.Uri.parse('aicodehelperdiff:leftContent' + `${new Date().getTime()}${Math.random()}`.replace('.', ''));
	class LeftContentProvider { provideTextDocumentContent(uri) { return leftContent; } }
	const leftContentProvider = new LeftContentProvider();
	const leftContentScheme = 'aicodehelperdiff';
	removeSelection();
	await vscode.workspace.registerTextDocumentContentProvider(leftContentScheme, leftContentProvider);
	const diffResult = await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, { preview: !true });
	//---
	if (false) {
		const contentTextEditor = diffResult.contentTextEditor;
		contentTextEditor.setDecorations(
			vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
				isWholeLine: true
			}),
			// getChangedLineRanges(contentTextEditor.document)
		);
		contentTextEditor.setDecorations(
			vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor('editor.findMatchBackground'),
				isWholeLine: true
			}),
			// getAddedLineRanges(contentTextEditor.document)
		);
	}
}
async function applyChangesToOriginalDocument() {
	/*
	"menus": {
	  "editor/title": [
		{
		  "command": "extension.applyChanges",
		  "when": "true",
		  "group": "navigation"
		}
	  ]
	},
	  {
		"command": "extension.applyChanges",
		"title": "Apply Changes"
	  },
	*/

	const editor = vscode.window.activeTextEditor;
	const selectedText = editor.document.getText(editor.selection);
	const updatedContent = "Updated Content";
	await editor.edit(editBuilder => {
		editBuilder.replace(editor.selection, updatedContent);
	});
}

function makeid(length) {
	let result = '';
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	let counter = 0;
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
		counter += 1;
	}
	return result;
}
function getTemperature() {
	const defaultValue = 0.8
	let value = defaultValue;
	try { value = Number(getConfigValue('temperature')) } catch { }
	if (isNaN(value)) value = defaultValue;
	return value;
}
async function inputAPIKeyDialog() {
	let res = await vscode.window.showInputBox({
		title: "Setting Up an API Key",
		placeHolder: "sk-XXXX...",
		password: true,
		prompt: `Please enter the API key issued by OpenAI. You can obtain an API key from here: https://platform.openai.com/account/api-keys. please be aware that there may be charges incurred depending on your usage.`,
		value: ''
	});
	return res;
}
function showTokenUsage(response) {
	let message = 'Successfully Done!';
	try {
		let usage = response.actualUsage.total_tokens;
		if (usage) message += ` ${usage} tokens used`;
	} catch { }
	vscode.window.showInformationMessage(message);
	// vscode.window.setStatusBarMessage(message, 2000);
}
async function readResource(path, context) {
	const uri = vscode.Uri.file(context.asAbsolutePath(path));
	try {
		const data = await vscode.workspace.fs.readFile(uri);
		return data.toString();
	} catch (err) {
		console.error(err);
	}
}
function showError({ context, msg }) {
	if (!msg) msg = 'Failed to process your request.'
	vscode.window.showErrorMessage(msg)
	const msglist = [`Incorrect API key provided:`, `You didn't provide an API key.`];
	let filtered = msglist.filter(m => msg.trim().startsWith(m))
	if (!!filtered.length) {
		(async () => {
			let apikey = await inputAPIKeyDialog();
			if (!apikey) return;
			await secureStore(context, apikey);
			vscode.window.showInformationMessage(`The API key has been set. Please try again.`)
		})()
	}
}
function parseData(response, text) {
	try {
		let code = (response.content) ? response.content.trim() : ''
		let ccode = code.split('```');
		if (ccode.length === 3) {
			let codelist = ccode[1].split('\n')
			codelist.shift();
			code = codelist.join('\n')
		}
		let endcode = text.endsWith('\n') ? '\n' : ''
		let res = {};
		if (code) {
			res.code = code + endcode;
		} else {
			let failReason = response?.error?.message ? response?.error?.message : ''
			res.error = failReason;
		}
		return res;
	} catch (e) {
		return e.toString();
	}
}
function getFirstLinePositionOfSelection() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;
	const selection = editor.selection;
	const startPosition = selection.start;
	const firstLineStartPosition = new vscode.Position(startPosition.line, 0);
	return firstLineStartPosition;
}
function insertNewLineOnTopOfCursor(txt, seld) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;
	editor.edit(editBuilder => {
		editBuilder.insert(seld ? seld : getFirstLinePositionOfSelection(), txt + '\n');
	});
}
function getConfigValue(keyname) {
	const config = vscode.workspace.getConfiguration('aicodehelper');
	let value;
	try {
		value = config.get(keyname);
	} catch { }
	if (keyname === 'gptkey' && value === MASKING) value = '';
	return value;
}
async function setConfigValue(keyname, value) {
	try {
		const config = vscode.workspace.getConfiguration('aicodehelper');
		await config.update(keyname, value, vscode.ConfigurationTarget.Global);
	} catch { }
}
function bindingTemplate(template, data) {
	data.newline = '\n';
	if (!data.language) data.language = 'english';
	Object.keys(data).forEach(key => {
		template = template.split('{{' + key + '}}').join(data[key]);
	});
	return template;
}
async function secureStore(context, inputkey) {
	let setting = getConfigValue('gptkey');
	let keytars;
	await setKeyFromVSCodeSecure(context, setting)
	await setKeyFromVSCodeSecure(context, keytars)
	await setKeyFromVSCodeSecure(context, inputkey)
	await removeAllPassword();
	if (setting || keytars || inputkey) await setConfigValue('gptkey', MASKING);
}
async function setKeyFromVSCodeSecure(context, value) {
	if (!value || value === MASKING || value.startsWith('encrypted-')) return;
	try { data = await context.secrets.store('gptkey', value); } catch (e) { }
}
async function getKeyFromVSCodeSecure(context) {
	let data = '';
	try { data = await context.secrets.get('gptkey'); } catch (e) { }
	return data;
}
async function addRecentPrompts(context, prompt, storeId, limit = 100) {
	const removeStringFromArray = (arr, str) => {
		const index = arr.indexOf(str);
		if (index !== -1) arr.splice(index, 1);
		return arr;
	}
	if (prompt) prompt = prompt.trim();
	if (!prompt) return;
	try {
		let data = await getRecentPrompts(context, storeId)
		data = [prompt, ...removeStringFromArray(data, prompt).splice(0, limit - 1)];
		await context.secrets.store(storeId, JSON.stringify(data));
	} catch (e) { }
}
async function getRecentPrompts(context, storeId) {
	let data = [];
	try {
		let _data = await context.secrets.get(storeId);
		_data = JSON.parse(_data);
		if (_data.constructor === Array) data = _data;
	} catch (e) { }
	return data;
}
function selectTheLineCursorIsOn() {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		const position = editor.selection.active;
		const start = position.with(position.line, 0);
		const end = position.with(position.line, getTextAtCursor().length);//.translate(1);
		const selection = new vscode.Selection(start, end);
		editor.selection = selection;
	}
}
function isSelected() {
	try {
		const editor = vscode.window.activeTextEditor;
		if (!editor) throw new Error('no editor')
		const selection = editor.selection;
		return !!(editor.document.getText(selection).length);
	} catch { }
	return false;
}
function getTextAtCursor() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;
	const cursorPosition = editor.selection.active;
	const line = editor.document.lineAt(cursorPosition.line);
	return line.text;
}


async function getGPTAPIKey(context) {
	await secureStore(context);
	return await getKeyFromVSCodeSecure(context);
}
async function formatSelection() {
	await new Promise(r => setTimeout(r, 0));
	await vscode.commands.executeCommand('editor.action.formatSelection');
}
async function activate(context) {
	await secureStore(context);
	const encoder = JSON.parse(await readResource('assets/encoder.json', context));
	const bpe_file = await readResource('assets/vocab.bpe', context);
	let tabChangeNo = Math.random();
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
		tabChangeNo = Math.random();
		return;
		if (editor) {
			console.log(`Switched to ${editor.document.fileName}`);
		} else {
			console.log('No active editor');
		}
	}));
	const requestingToAPI = async ({ title, content, system }) => {
		let prompt = [];
		system && prompt.push({ role: 'system', content: system });
		prompt.push({ role: 'user', content: content });
		const chatGPT = new ChatGPT({ apiKey: await getGPTAPIKey(context), encoder, bpe_file, promptTokenLimit: 2048, vscode });
		const cancellationTokenSource = new vscode.CancellationTokenSource();
		const controller = new AbortController();
		const signal = controller.signal;

		//--------
		const editor = vscode.window.activeTextEditor;
		const selectedText = editor.document.getText(editor.selection);
		const codeBefore = editor.document.getText();
		const tabChangeNoBefore = tabChangeNo;
		let abortion = false;
		let mode = 0;
		let loop = true;
		(async () => {
			while (true) {
				if (codeBefore !== editor.document.getText()) { mode = 303; abortion = true; }
				if (selectedText !== editor.document.getText(editor.selection)) { mode = 301; abortion = true; }
				if (tabChangeNoBefore !== tabChangeNo) { mode = 302; abortion = true; }
				if (abortion || !loop) break;
				await new Promise(resolve => setTimeout(resolve, 32));
			}
			if (abortion) {
				cancellationTokenSource.cancel();
				controller.abort();
			}
		})();

		let result = await vscode.window.withProgress({
			title, cancellable: true, location: vscode.ProgressLocation.Notification,
		}, async (progress, cancellationToken) => {
			cancellationToken.onCancellationRequested(() => {
				cancellationTokenSource.cancel()
				controller.abort();
			});
			try { return await chatGPT.completion(prompt, { temperature: system ? 0 : getTemperature() }, signal); } catch { }
		}, cancellationTokenSource.token);
		loop = false;
		if (false && result) {
			vscode.window.showInformationMessage(result.content)
			// vscode.window.showInformationMessage(JSON.stringify(result, undefined, 2))
		}
		if (!result || cancellationTokenSource.token.isCancellationRequested || abortion) {
			if (mode === 303) {
				result = { error: { message: 'The request was canceled because the code was changed.', mode } };
			} else if (mode === 302) {
				result = { error: { message: 'The request was canceled because you moved the tab.', mode } };
			} else if (mode === 301) {
				result = { error: { message: 'The request was canceled because you deselected the code.', mode } };
			} else {
				result = { error: { message: 'Request canceled', mode } };
			}
		}
		return result;
	};
	const affectResult = async (editor, text, selection, response) => {
		let mode;
		try { mode = response.error.mode; } catch { }
		if (mode === 302) {
			showError({ msg: `${response.error.message}`, context });
			return false;
		}
		let resolver;
		let promise = new Promise(resolve => resolver = resolve);
		editor.edit(editBuilder => {
			let res = parseData(response, text)
			if (res.code) {
				editBuilder.replace(selection, res.code);
				editor.selection = selection;
				(async () => {
					await formatSelection()
					resolver(true)
				})();
				showTokenUsage(response);
			} else {
				showError({ msg: `${res.error}`, context });
				resolver(false)
			}
		});
		return await promise;
	}
	let processStateToggle = false;
	function releaseToggle() {
		processStateToggle = false;
	}
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.codereview', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		let seld = getFirstLinePositionOfSelection()
		try {
			const activeEditor = vscode.window.activeTextEditor;
			const languageId = activeEditor.document.languageId;
			const content = bindingTemplate(getConfigValue('codereviewprompt'), { selectedcode: text, languageId, language: getConfigValue('language') });
			const system = `You are a ${languageId} coding expert assistant`;
			const response = await requestingToAPI({ title: 'Requesting code review from GPT AI....', content, system })
			editor.edit(editBuilder => {
				let res = parseData(response, text)
				if (res.code) {
					res.code = res.code.split('\n').map(line => {
						line = line.trim();
						if (line.startsWith('//')) line = line.slice(2)
						if (line.startsWith('#')) line = line.slice(1)
						return `|${line}`;
					}).join('\n');
					insertNewLineOnTopOfCursor(`${res.code}`, seld);
					editor.selection = new vscode.Selection(seld, seld.translate(res.code.split('\n').length, 0));
					(async () => {
						await vscode.commands.executeCommand('editor.action.commentLine');
						await formatSelection();
					})();
					showTokenUsage(response);
				} else {
					showError({ msg: `${res.error}`, context });
				}
			});
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.naming', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		try {
			const response = await requestingToAPI({ title: 'Naming from GPT AI..', ...makeReqForm('namingprompt', text) })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.debugging', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		try {
			const response = await requestingToAPI({ title: 'Debugging from GPT AI..', ...makeReqForm('debugprompt', text) })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.refactoring', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		try {
			const response = await requestingToAPI({ title: 'Requesting a refactoring from GPT AI..', ...makeReqForm('refactoringprompt', text) })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.scc', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		try {
			const response = await requestingToAPI({ title: 'Requesting a code completion from GPT AI..', ...makeReqForm('sccprompt', text) })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	if (false) {
		context.subscriptions.push(vscode.commands.registerCommand('extension.applyChanges', function () {
			applyChangesToOriginalDocument();
		}));
	}

	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.addComment', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		try {
			const response = await requestingToAPI({ title: 'Requesting annotations from GPT AI..', ...makeReqForm('commmentingprompt', text) })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.generateCode', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		try {
			const activeEditor = vscode.window.activeTextEditor;
			const languageId = activeEditor.document.languageId;
			const content = bindingTemplate(getConfigValue('generatingprompt'), { selectedcode: text, languageId, language: getConfigValue('language') });
			const system = `You are a ${languageId} coding expert assistant`;
			const response = await requestingToAPI({ title: 'Generating code from GPT AI....', content, system })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.justAsking', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		try {
			const response = await requestingToAPI({ title: 'Requesting to GPT AI....', content: text })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.justInputAsking', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		let res = vscode.window.showInputBox({
			placeHolder: "",
			prompt: "What would you like to do about selected text?",
			value: ''
		});
		let prompt = await res;
		if (!prompt) { releaseToggle(); return; }
		try {
			await addRecentPrompts(context, prompt, 'recentprompt');
			const fencedCodeBlock = '```';
			const requestPrompt = `INPUT FOR REQUEST: fenced Code Block\nREQUEST: ${prompt}.`;//\nINSTRUCTIONS: Response only the main result without explanations, annotations, comments, descriptions.`;
			const response = await requestingToAPI({ title: 'Requesting to GPT AI....', content: `${fencedCodeBlock}\n${text}${fencedCodeBlock}\n\n${requestPrompt}` })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.justInputCodingAsking', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		let res = vscode.window.showInputBox({
			placeHolder: "",
			prompt: "What would you like to do about selected code?",
			value: ''
		});
		let prompt = await res;
		if (!prompt) { releaseToggle(); return; }
		try {
			await addRecentPrompts(context, prompt, 'recentcodeprompt');
			const system = `You are a coding expert assistant. Modify the code inside the fenced code block as requested by the user and response the modified code.`;
			const fencedCodeBlock = '```';
			const requestPrompt = `INPUT FOR REQUEST: fenced Code Block\nREQUEST: ${prompt}.`;//\nINSTRUCTIONS: Response only the main result without explanations, annotations, comments, descriptions.`;
			const response = await requestingToAPI({ title: 'Requesting to GPT AI....', content: `${fencedCodeBlock}\n${text}${fencedCodeBlock}\n\n${requestPrompt}`, system })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.recentHistoryOfAsking', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		//--------
		if (false) {
			const items = ['Item 1', 'Item 2', 'Item 3'];
			const quickPick = vscode.window.createQuickPick();
			quickPick.items = items;
			quickPick.canPickMany = false;
			quickPick.title = 'My QuickPick';
			quickPick.width = 2200; // 너비 설정
			quickPick.show();
			releaseToggle(); return;
		}
		const items = await getRecentPrompts(context, 'recentprompt');
		if (!items.length) {
			releaseToggle();
			vscode.window.showInformationMessage(`No Recent Prompt History`)
			return;
		}
		let prompt = await vscode.window.showQuickPick(items, {
			title: 'Recent Prompts',
			placeHolder: 'Select a prompt',
			canPickMany: false,
			ignoreFocusOut: false
		});
		//--------
		if (!prompt) { releaseToggle(); return; }
		//--------
		prompt = await vscode.window.showInputBox({
			placeHolder: "",
			prompt: "What would you like to do about selected text?",
			value: prompt
		});
		if (!prompt) { releaseToggle(); return; }
		//--------
		try {
			await addRecentPrompts(context, prompt, 'recentprompt');
			const fencedCodeBlock = '```';
			const requestPrompt = `INPUT FOR REQUEST: fenced Code Block\nREQUEST: ${prompt}.`;//\nINSTRUCTIONS: Response only the main result without explanations, annotations, comments, descriptions.`;
			const response = await requestingToAPI({ title: 'Requesting to GPT AI....', content: `${fencedCodeBlock}\n${text}${fencedCodeBlock}\n\n${requestPrompt}` })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.recentHistoryOfCodingAsking', async function () {
		if (processStateToggle) { showError({ msg: 'Please retry after previous processing is complete', context }); return; }
		processStateToggle = true;
		if (!isSelected()) selectTheLineCursorIsOn();
		const editor = vscode.window.activeTextEditor;
		if (!editor) { releaseToggle(); return; }
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		if (!text || !text.trim()) { releaseToggle(); return; }
		//--------
		if (false) {
			const items = ['Item 1', 'Item 2', 'Item 3'];
			const quickPick = vscode.window.createQuickPick();
			quickPick.items = items;
			quickPick.canPickMany = false;
			quickPick.title = 'My QuickPick';
			quickPick.width = 2200; // 너비 설정
			quickPick.show();
			releaseToggle(); return;
		}
		const items = await getRecentPrompts(context, 'recentcodeprompt');
		if (!items.length) {
			releaseToggle();
			vscode.window.showInformationMessage(`No Recent Prompt History`)
			return;
		}
		let prompt = await vscode.window.showQuickPick(items, {
			title: 'Recent Prompts',
			placeHolder: 'Select a prompt',
			canPickMany: false,
			ignoreFocusOut: false
		});
		//--------
		if (!prompt) { releaseToggle(); return; }
		//--------
		prompt = await vscode.window.showInputBox({
			placeHolder: "",
			prompt: "What would you like to do about selected code?",
			value: prompt
		});
		if (!prompt) { releaseToggle(); return; }
		//--------
		try {
			await addRecentPrompts(context, prompt, 'recentcodeprompt');
			const system = `You are a coding expert assistant. Modify the code inside the fenced code block as requested by the user and response the modified code.`;
			const fencedCodeBlock = '```';
			const requestPrompt = `INPUT FOR REQUEST: fenced Code Block\nREQUEST: ${prompt}.`;//\nINSTRUCTIONS: Response only the main result without explanations, annotations, comments, descriptions.`;
			const response = await requestingToAPI({ title: 'Requesting to GPT AI....', content: `${fencedCodeBlock}\n${text}${fencedCodeBlock}\n\n${requestPrompt}`, system })
			const originalCode = editor.document.getText();
			if (await affectResult(editor, text, selection, response)) { await showDiff(originalCode) }
		} catch { }
		releaseToggle();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.registAPIKey', async function () {
		let apikey = await inputAPIKeyDialog();
		if (!apikey) return;
		await secureStore(context, apikey);
		vscode.window.showInformationMessage(`AICodeHelper - The API key has been set.`)
	}));
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.resetEverything', async function () {
		let res = await vscode.window.showInputBox({
			title: "Are you sure to reset every configuration of AICodeHelper?",
			placeHolder: "If you want to reset, type 'yes'",
			value: ''
		});
		if (res === 'yes') {
			await resetAll(context);
			vscode.window.showInformationMessage(`AICodeHelper - Configuration Reset`)
		}
	}));
	if (false) {
		context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(function (event) {
			if (isDiffCopyAction(event)) { }
		}));
	}
	context.subscriptions.push(vscode.commands.registerCommand('aicodehelper.resetPromptHistory', async function () {
		let res = await vscode.window.showInputBox({
			title: "Are you sure to reset recent prompt history of AICodeHelper?",
			placeHolder: "If you want to reset, type 'yes'",
			value: ''
		});
		if (res === 'yes') {
			await resetPromptsHistory(context)
			vscode.window.showInformationMessage(`AICodeHelper - Recent Prompt History Reset`)
		}
	}));
	vscode.workspace.onDidChangeConfiguration(() => {
		if (!getConfigValue('gptkey')) return;
		1 && (async () => await secureStore(context))();
		0 && vscode.window.showInformationMessage(`Configuration of AICodeHelper has been changed`);
	});
}
function deactivate() { }
module.exports = {
	activate,
	deactivate
}