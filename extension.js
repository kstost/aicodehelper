const vscode = require('vscode');
const keytar = require('keytar');
const ChatGPT = require('./ChatGPT');
const { removeAllPassword, resetAll, resetPromptsHistory } = require('./storageManager');
const MASKING = '****';
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
		let dcode = code.split('\n');
		if (dcode[0].startsWith('```') && dcode[dcode.length - 1] === '```') {
			dcode[0] = ''
			dcode[dcode.length - 1] = '';
			code = dcode.join('\n').trim();
		} else {
			const cnds = [
				code.split('```').length === 3,
				code.split('\n').filter(line => line.startsWith('```')).length === 2
			]
			const conditions = cnds.filter(Boolean).length === cnds.length
			if (conditions) {
				const splc = code.split('\n');
				let accus = [];
				let add = false
				for (let line of splc) {
					if (line.startsWith('```')) { add = !add; continue; }
					if (add) accus.push(line);
				}
				code = accus.join('\n').trim();
			}
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
	return value;
}
function setConfigValue(keyname, value) {
	try {
		const config = vscode.workspace.getConfiguration('aicodehelper');
		config.update(keyname, value, vscode.ConfigurationTarget.Global);
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
	try { keytars = await keytar.getPassword('aicodehelper', setting); } catch { }
	await setKeyFromVSCodeSecure(context, setting)
	await setKeyFromVSCodeSecure(context, keytars)
	await setKeyFromVSCodeSecure(context, inputkey)
	await removeAllPassword();
	setConfigValue('gptkey', '')
	setConfigValue('gptkey', undefined)
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
async function addRecentPrompts(context, prompt, limit = 100) {
	const removeStringFromArray = (arr, str) => {
		const index = arr.indexOf(str);
		if (index !== -1) arr.splice(index, 1);
		return arr;
	}
	if (prompt) prompt = prompt.trim();
	if (!prompt) return;
	try {
		let data = await getRecentPrompts(context)
		data = [prompt, ...removeStringFromArray(data, prompt).splice(0, limit - 1)];
		context.secrets.store('recentprompt', JSON.stringify(data));
	} catch (e) { }
}
async function getRecentPrompts(context) {
	let data = [];
	try {
		let _data = await context.secrets.get('recentprompt');
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
async function activate(context) {
	await secureStore(context);
	const encoder = JSON.parse(await readResource('assets/encoder.json', context));
	const bpe_file = await readResource('assets/vocab.bpe', context);
	const requestingToAPI = async ({ title, content, system }) => {
		let prompt = [];
		system && prompt.push({ role: 'system', content: system });
		prompt.push({ role: 'user', content: content });
		const chatGPT = new ChatGPT({ apiKey: await getGPTAPIKey(context), encoder, bpe_file, promptTokenLimit: 2048, vscode });
		return await vscode.window.withProgress({
			title, cancellable: false, location: vscode.ProgressLocation.Notification,
		}, async (progress) => await chatGPT.completion(prompt, { temperature: system ? 0 : getTemperature() }));
	};
	const affectResult = (editor, text, selection, response) => {
		editor.edit(editBuilder => {
			let res = parseData(response, text)
			if (res.code) {
				editBuilder.replace(selection, res.code);
				editor.selection = selection;
				showTokenUsage(response);
			} else {
				showError({ msg: `${res.error}`, context });
			}
		});
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
			console.log(system)
			const response = await requestingToAPI({ title: 'Requesting code review from GPT AI....', content, system })
			editor.edit(editBuilder => {
				let res = parseData(response, text)
				if (res.code) {
					insertNewLineOnTopOfCursor(`${res.code}`, seld);
					editor.selection = new vscode.Selection(seld, seld.translate(res.code.split('\n').length, 0));
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
			const activeEditor = vscode.window.activeTextEditor;
			const languageId = activeEditor.document.languageId;
			const content = bindingTemplate(getConfigValue('namingprompt'), { selectedcode: text, languageId, language: getConfigValue('language') });
			const system = `You are a coding expert assistant`;
			console.log(system)
			const response = await requestingToAPI({ title: 'Naming from GPT AI....', content, system })
			affectResult(editor, text, selection, response)
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
			const activeEditor = vscode.window.activeTextEditor;
			const languageId = activeEditor.document.languageId;
			const content = bindingTemplate(getConfigValue('refactoringprompt'), { selectedcode: text, languageId, language: getConfigValue('language') });
			const system = `You are a ${languageId} coding expert assistant`;
			console.log(system)
			const response = await requestingToAPI({ title: 'Requesting a refactoring from GPT AI....', content, system })
			affectResult(editor, text, selection, response)
		} catch { }
		releaseToggle();
	}));
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
			const activeEditor = vscode.window.activeTextEditor;
			const languageId = activeEditor.document.languageId;
			const content = bindingTemplate(getConfigValue('commmentingprompt'), { selectedcode: text, languageId, language: getConfigValue('language') });
			const system = `You are a ${languageId} coding expert assistant`;
			console.log(system)
			const response = await requestingToAPI({ title: 'Requesting annotations from GPT AI....', content, system })
			affectResult(editor, text, selection, response)
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
			console.log(system)
			const response = await requestingToAPI({ title: 'Generating code from GPT AI....', content, system })
			affectResult(editor, text, selection, response)
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
			affectResult(editor, text, selection, response)
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
			await addRecentPrompts(context, prompt);
			const response = await requestingToAPI({ title: 'Requesting to GPT AI....', content: `${text}\n${prompt}` })
			affectResult(editor, text, selection, response)
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
		const items = await getRecentPrompts(context);
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
		try {
			await addRecentPrompts(context, prompt);
			const response = await requestingToAPI({ title: 'Requesting to GPT AI....', content: `${text}\n${prompt}` })
			affectResult(editor, text, selection, response)
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
	// console.log(setConfigValue('language1', '1234'));
	// console.log(getConfigValue('language1'));
}
function deactivate() { }
module.exports = {
	activate,
	deactivate
}