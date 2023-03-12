if (false) {
    const {
        removeAllPassword,
        removeAllConfigs,
        resetAll
    } = require('./storageManager');
    (async () => {
        await resetAll();
    })();
}