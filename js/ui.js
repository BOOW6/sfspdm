import { CONFIG } from './config.js';
import { STATE } from './state.js';

export const UI = {
    els: {
        speed: null,
        unit: null,
        max: null,
        odo: null,
        ring: null,
        ringVal: null,
        status: null,
        badges: {
            gps: null,
            motion: null,
            wake: null
        }
    },

    init: () => {
        UI.els.speed = document.getElementById('speed-display');
        UI.els.unit = document.getElementById('unit-display');
        UI.els.max = document.getElementById('max-speed');
        UI.els.odo = document.getElementById('odometer');
        UI.els.ring = document.querySelector('.progress-circle');
        UI.els.ringVal = document.querySelector('.progress-circle .progress-value');
        UI.els.status = document.getElementById('fusion-status');
        UI.els.badges.gps = document.getElementById('badge-gps');
        UI.els.badges.motion = document.getElementById('badge-motion');
        UI.els.badges.wake = document.getElementById('badge-wakelock');
    },

    formatSpeed: (ms) => {
        let val = 0;
        switch(CONFIG.unit) {
            case 'kmh': val = ms * 3.6; break;
            case 'mph': val = ms * 2.23694; break;
            case 'kts': val = ms * 1.94384; break;
        }
        return val.toFixed(1);
    },

    formatDistance: (meters) => {
        const km = meters / 1000;
        return km.toFixed(2);
    },

    updateFusionBadge: (text, colorClass) => {
        const el = document.getElementById('fusion-status');
        if(el) {
            el.textContent = text;
            el.className = `mt-4 text-sm font-medium opacity-80 h-6 ${colorClass}`;
        }
    },

    setStatus: (type, status) => {
        const el = UI.els.badges[type];
        if (!el) return;

        if (status === 'active') {
            el.className = "px-2 py-1 rounded text-xs font-bold bg-[var(--accent-color)] text-black transition-colors";
        } else if (status === 'error') {
            el.className = "px-2 py-1 rounded text-xs font-bold bg-[var(--danger-color)] text-white transition-colors";
        } else if (status === 'warn') {
            el.className = "px-2 py-1 rounded text-xs font-bold bg-[var(--warn-color)] text-black transition-colors";
        } else {
            el.className = "px-2 py-1 rounded text-xs font-bold bg-[var(--border-color)] text-[var(--text-color)]/60 transition-colors";
        }
    },

    render: () => {
        if (!UI.els.speed) UI.init(); 

        // 更新数字
        const displaySpeed = UI.formatSpeed(STATE.speed);
        if(UI.els.speed) UI.els.speed.textContent = displaySpeed;
        if(UI.els.max) UI.els.max.textContent = UI.formatSpeed(STATE.maxSpeed);
        if(UI.els.odo) UI.els.odo.textContent = UI.formatDistance(STATE.distance);

        // 更新进度环
        let percent = parseFloat(displaySpeed) / CONFIG.maxScale;
        if (percent > 1) percent = 1;
        if (percent < 0) percent = 0;

        if (UI.els.ring) {
            // 获取容器尺寸
            const circbg = document.getElementById("circle-bg");
            const size = circbg ? circbg.offsetHeight : 0;

            if (size > 0) {
                UI.els.ring.style.setProperty('--size', size + 'px');
                
                // 手动计算周长以避免 CSS calc 问题
                // CSS: r = (size - border) / 2; border = size / 16
                // r = size * (1 - 1/16) / 2 = size * 15 / 32
                const r = size * 15 / 32;
                const circumference = 2 * Math.PI * r;
                const dash = circumference * percent;

                // 确保获取了 svg circle 元素
                if (!UI.els.ringVal) UI.els.ringVal = UI.els.ring.querySelector('.progress-value');
                
                if (UI.els.ringVal) {
                    // 应用 dasharray
                    UI.els.ringVal.style.strokeDasharray = `${dash} ${circumference}`;
                    UI.els.ringVal.style.strokeDashoffset = '0'; // 确保从头开始

                    // 数值为0时隐藏
                    UI.els.ringVal.style.opacity = (percent <= 0) ? '0' : '1';
                    
                    // 更新颜色
                    let colorVar = 'var(--accent-color)';
                    if (percent > 0.8) colorVar = 'var(--danger-color)';
                    else if (percent > 0.5) colorVar = 'var(--warn-color)';
                    
                    UI.els.ringVal.style.stroke = colorVar;
                }
            }
        }
    }
};

