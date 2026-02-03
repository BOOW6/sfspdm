export const Logger = {
    log: (callerName, msg, type = 'info') => {
        const consoleEl = document.getElementById('console-log');
        if (!consoleEl) return;
        
        const line = document.createElement('div');
        const time = new Date().toLocaleTimeString().split(' ')[0];
        line.textContent = `[${time}] [${callerName}] ${msg}`;

        if (type === 'error') line.style.color = '#ef4444';
        if (type === 'warn') line.style.color = '#fbbf24';

        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    },
    clear: () => {
        const consoleEl = document.getElementById('console-log');
        if (consoleEl) consoleEl.innerHTML = '';
    }
};
