import { CONFIG } from './core/config.js';
import { Logger } from './utils/logger.js';
import { Hardware } from './core/hardware.js';
import { UI } from './ui/ui.js';

// --- 事件绑定 ---
const btnStart = document.getElementById('btn-start');
if (btnStart) {
    btnStart.addEventListener('click', Hardware.init);
}

const btnSettings = document.getElementById('btn-settings');
if (btnSettings) {
    btnSettings.addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('hidden');
    });
}

const btnCloseSettings = document.getElementById('btn-close-settings');
if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
        document.getElementById('settings-modal').classList.add('hidden');
    });
}

document.querySelectorAll('button[data-unit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        CONFIG.unit = e.target.dataset.unit;
        
        const unitDisplay = document.getElementById('unit-display');
        if(unitDisplay) {
            unitDisplay.textContent = CONFIG.unit === 'kmh' ? 'km/h' : (CONFIG.unit === 'mph' ? 'mph' : 'knots');
        }

        document.querySelectorAll('button[data-unit]').forEach(b => {
            b.className = "flex-1 py-2 text-sm rounded-md text-gray-400 hover:text-white transition-colors";
        });
        e.target.className = "flex-1 py-2 text-sm rounded-md bg-[var(--accent-color)] text-black font-bold transition-colors";
    });
});

const algoSelect = document.getElementById('algo-select');
if (algoSelect) {
    algoSelect.addEventListener('change', (e) => {
        CONFIG.mode = e.target.value;
        Logger.log(`切换算法模式: ${e.target.options[e.target.selectedIndex].text}`);
    });
}

const scaleRange = document.getElementById('scale-range');
if (scaleRange) {
    scaleRange.addEventListener('input', (e) => {
        CONFIG.maxScale = parseInt(e.target.value);
        const scaleVal = document.getElementById('scale-val');
        if(scaleVal) scaleVal.textContent = CONFIG.maxScale;
    });
}

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('theme-oled');
            Logger.log("启用 OLED 纯黑模式");
        } else {
            document.body.classList.remove('theme-oled');
            Logger.log("启用 标准暗色模式");
        }
    });
}

const clearLog = document.getElementById('clear-log');
if (clearLog) {
    clearLog.addEventListener('click', Logger.clear);
}

UI.init();
Logger.log("系统就绪，等待启动...", "info");
