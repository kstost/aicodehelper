const vscode = require('vscode');
async function removeAllPassword() {
}
function removeAllConfigs() {
    const config = vscode.workspace.getConfiguration('aicodehelper');
    let keys = [
        'temperature',
        'debugprompt',
        'namingprompt',
        'codereviewprompt',
        'refactoringprompt',
        'sccprompt',
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
    await context.secrets.store('recentcodeprompt', JSON.stringify([]));
}

module.exports = {
    removeAllPassword,
    removeAllConfigs,
    resetAll,
    resetPromptsHistory
};
