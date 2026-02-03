import { CONFIG } from './config.js';
import { STATE } from './state.js';

export const UI = {
    els: {
        speed: null,
        unit: null,
        max: null,
        odo: null,
        ring: null,
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
            el.className = "px-2 py-1 rounded text-xs font-bold bg-gray-700 text-gray-400 transition-colors";
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
        const percent = parseFloat(displaySpeed) / CONFIG.maxScale;
        // if (percent > 1) percent = 1;
        const offset = 100 - (percent * 100);
        const offset = 50; // debug

        // const progressEl = document.querySelector('.progress-circle');
        UI.els.ring.style.setProperty('--percent', offset + 'px');

        const circbg = document.getElementById("circle-bg");
        UI.els.ring.style.setProperty('--size', circbg.offsetHeight + 'px');

        if(UI.els.ring) {
            UI.els.ring.style.strokeDashoffset = offset;

            if (percent > 0.8) UI.els.ring.style.color = 'var(--danger-color)';
            else if (percent > 0.5) UI.els.ring.style.color = 'var(--warn-color)';
            else UI.els.ring.style.color = 'var(--accent-color)';
        }
    }
};

