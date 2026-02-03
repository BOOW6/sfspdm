import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Hardware } from './hardware.js';
import { UI } from './ui.js';

const modulename = "main";

/* 事件绑定 */
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
        Logger.log(modulename, `切换算法模式: ${e.target.options[e.target.selectedIndex].text}`);
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
            Logger.log(modulename, "启用 纯黑主题");
        } else {
            document.body.classList.remove('theme-oled');
            Logger.log(modulename, "启用 标准暗色主题");
        }
    });
}

const clearLog = document.getElementById('clear-log');
if (clearLog) {
    clearLog.addEventListener('click', Logger.clear);
}



/* 拖拽 */
const draggable = document.querySelector('.draggable');
const parent = draggable.parentNode;
let isDragging = false;
let startX, startY, currentX = 0, currentY = 0;
draggable.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
});
document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    parent.style.transform = `translate(${currentX}px, ${currentY}px)`;
});
document.addEventListener('mouseup', () => {
    isDragging = false;
});



UI.init();
Logger.log(modulename, "系统就绪，等待启动...", "info");
