const vscode = require('vscode');
const keytar = require('keytar');
async function removeAllPassword() {
    const serviceName = 'aicodehelper';
    try {
        const accounts = await keytar.findCredentials(serviceName);
        for (const account of accounts) await keytar.deletePassword(serviceName, account.account);
    } catch { }
}
function removeAllConfigs() {
    const config = vscode.workspace.getConfiguration('aicodehelper');
    let keys = [
        'temperature',
        'debugprompt',
        'namingprompt',
        'codereviewprompt',
        'refactoringprompt',
        'commmentingprompt',
        'generatingprompt',
        'gptkey',
        'APIKey',
        'language',
    ]
    for (const key of keys) config.update(key, undefined, vscode.ConfigurationTarget.Global);
}
async function resetAll(context) {
    await removeAllPassword();
    removeAllConfigs();
    await resetPromptsHistory(context)
    try { data = await context.secrets.store('gptkey', undefined); } catch (e) { }
}

async function resetPromptsHistory(context) {
    await context.secrets.store('recentprompt', JSON.stringify([]));
}

module.exports = {
    removeAllPassword,
    removeAllConfigs,
    resetAll,
    resetPromptsHistory
};
