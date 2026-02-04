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
            Logger.log(modulename, "应用 纯黑主题");
        } else {
            document.body.classList.remove('theme-oled');
            Logger.log(modulename, "应用 标准暗色主题");
        }
    });
}

const clearLog = document.getElementById('clear-log');
if (clearLog) {
    clearLog.addEventListener('click', Logger.clear);
}



/* 拖拽功能 */
const draggable = document.querySelector('.draggable');
const dragParent = draggable.parentNode;
let isDragging = false;
let startX, startY, currentX = 0, currentY = 0;

// 获取事件坐标的辅助函数 (兼容鼠标和触摸)
const getEventXY = (e) => {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
};

/* 事件监听 */
// 鼠标事件
draggable.addEventListener('mousedown', handleDragStart);
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);

// 触摸事件
draggable.addEventListener('touchstart', handleDragStart, { passive: false });
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('touchend', handleDragEnd);

function handleDragStart(e) {
    isDragging = true;
    const { x, y } = getEventXY(e);
    startX = x - currentX;
    startY = y - currentY;

    // 防止触摸屏触发默认的滚动或长按菜单
    if (e.type === 'touchstart') {
        // e.preventDefault(); // 如果需要彻底阻止默认行为可开启
    }
}

function handleDragMove(e) {
    if (!isDragging) return;

    // 在移动端，拖动时通常需要阻止页面滚动
    if (e.cancelable) e.preventDefault();

    const { x, y } = getEventXY(e);
    currentX = x - startX;
    currentY = y - startY;

    dragParent.style.transform = `translate(${currentX}px, ${currentY}px)`;
}

function handleDragEnd() {
    isDragging = false;
}



UI.init();
Logger.log(modulename, "系统就绪，等待启动...", "info");
