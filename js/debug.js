import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { Logger } from './logger.js';

const modulename = "debug";

export const DebugCore = {
    flags: {
        forceTunnel: false, // 强制阻断真实GPS
        forceZupt: false,   // 强制零速
        accelPulseStart: 0, // 加速脉冲开始时间
    },
    history: [], // Sparkline data: {t, fusion, gps, acc}
    maxHistory: 100,
    canvas: null,
    ctx: null,
    onInjectGPS: null,

    init: (injectGPSCallback) => {
        DebugCore.onInjectGPS = injectGPSCallback;
        DebugCore.canvas = document.getElementById('sparkline-canvas');
        if (DebugCore.canvas) {
            DebugCore.ctx = DebugCore.canvas.getContext('2d');
            DebugCore.resizeCanvas();
            window.addEventListener('resize', DebugCore.resizeCanvas);
        }

        // 绑定调试按钮事件
        const debugToggle = document.getElementById('debug-toggle');
        if (debugToggle) {
            debugToggle.addEventListener('change', (e) => {
                CONFIG.debug = e.target.checked;
                const debugPanel = document.getElementById('debug-panel');
                // const miniStats = document.getElementById('debug-mini-stats');
                
                if(debugPanel) debugPanel.classList.toggle('hidden', !CONFIG.debug);
                // if(miniStats) {
                //     miniStats.classList.toggle('flex', CONFIG.debug);
                //     miniStats.classList.toggle('hidden', !CONFIG.debug);
                // }
                
                if(CONFIG.debug) DebugCore.resizeCanvas();
                Logger.log(modulename, `调试模式: ${CONFIG.debug ? '开启' : '关闭'}`);
            });
        }

        const btnInject = document.getElementById('btn-inject-gps');
        if (btnInject) {
            btnInject.addEventListener('click', () => {
                const speedInput = document.getElementById('dbg-gps-speed');
                const accInput = document.getElementById('dbg-gps-acc');
                
                if (speedInput && accInput && DebugCore.onInjectGPS) {
                    const speedKmh = parseFloat(speedInput.value);
                    const acc = parseFloat(accInput.value);
                    // 构造虚假 GPS 事件
                    DebugCore.onInjectGPS({
                        coords: {
                            latitude: 0, longitude: 0,
                            accuracy: acc,
                            speed: speedKmh / 3.6
                        },
                        timestamp: Date.now()
                    });
                    Logger.log(modulename, `Inject GPS Speed: ${speedKmh}km/h, Acc: ${acc}m`);
                }
            });
        }

        const btnTunnel = document.getElementById('btn-force-tunnel');
        if (btnTunnel) {
            btnTunnel.addEventListener('click', (e) => {
                DebugCore.flags.forceTunnel = !DebugCore.flags.forceTunnel;
                const btn = e.currentTarget;
                btn.classList.toggle('bg-red-600');
                btn.classList.toggle('bg-[var(--border-color)]');
                btn.classList.toggle('hover:bg-red-600/60');
                btn.classList.toggle('hover:bg-[var(--border-color)]/60');
                Logger.log(modulename, `屏蔽 GPS ${DebugCore.flags.forceTunnel ? '开启' : '关闭'}`);
            });
        }

        const btnPulse = document.getElementById('btn-pulse-accel');
        if (btnPulse) {
            btnPulse.addEventListener('click', () => {
                DebugCore.flags.accelPulseStart = Date.now();
                Logger.log(modulename, "触发 2s 2m/s² 加速度脉冲");
            });
        }

        const btnZupt = document.getElementById('btn-force-zupt');
        if (btnZupt) {
            btnZupt.addEventListener('click', (e) => {
                DebugCore.flags.forceZupt = !DebugCore.flags.forceZupt;
                const btn = e.currentTarget;
                btn.classList.toggle('bg-green-600');
                btn.classList.toggle('bg-[var(--border-color)]');
                btn.classList.toggle('hover:bg-green-600/60');
                btn.classList.toggle('hover:bg-[var(--border-color)]/60');
                Logger.log(modulename, `强制 ZUPT 静止 ${DebugCore.flags.forceZupt ? '开启' : '关闭'}`);
            });
        }

        // 输入框即时显示
        const updateDisp = () => {
            const sEl = document.getElementById('dbg-gps-speed');
            const aEl = document.getElementById('dbg-gps-acc');
            const dispEl = document.getElementById('dbg-gps-val-disp');
            if (sEl && aEl && dispEl) {
                dispEl.textContent = `${sEl.value} km/h / ${aEl.value}m`;
            }
        };
        const sEl = document.getElementById('dbg-gps-speed');
        const aEl = document.getElementById('dbg-gps-acc');
        if(sEl) sEl.addEventListener('input', updateDisp);
        if(aEl) aEl.addEventListener('input', updateDisp);
    },

    resizeCanvas: () => {
        if(!DebugCore.canvas) return;
        const rect = DebugCore.canvas.parentElement.getBoundingClientRect();
        DebugCore.canvas.width = rect.width;
        DebugCore.canvas.height = rect.height;
    },

    // 在融合循环中调用的钩子，用于注入虚假数据
    getInjectedAccel: (realAccMag) => {
        // 1. ZUPT 强制静止
        if (DebugCore.flags.forceZupt) return 0.01;

        // 2. 脉冲模拟
        if (Date.now() - DebugCore.flags.accelPulseStart < 2000) {
            return 2.0; // 模拟 2m/s²
        }

        return realAccMag;
    },

    shouldBlockGPS: () => {
        return DebugCore.flags.forceTunnel;
    },

    updateStats: (dt, gpsAge, kalmanK, rawGpsSpeed, rawAccMag) => {
        const elRawGps = document.getElementById('dbg-raw-gps');
        const elAccMag = document.getElementById('dbg-acc-mag');

        if(elRawGps) elRawGps.textContent = (rawGpsSpeed * 3.6).toFixed(1);
        if(elAccMag) elAccMag.textContent = rawAccMag.toFixed(2);

        if (!CONFIG.debug) return;

        // 更新文本数值
        const elDt = document.getElementById('dbg-dt');
        const elAge = document.getElementById('dbg-gps-age');
        const elX = document.getElementById('dbg-kalman-x');
        const elK = document.getElementById('dbg-kalman-k');
        const elP = document.getElementById('dbg-kalman-p');

        if(elDt) elDt.textContent = (dt * 1000).toFixed(0);
        if(elAge) elAge.textContent = gpsAge.toFixed(1);
        if(elX) elX.textContent = STATE.kalman.x.toFixed(2);
        if(elK) elK.textContent = kalmanK.toFixed(3);
        if(elP) elP.textContent = STATE.kalman.p.toFixed(2);

        // 更新波形数据
        DebugCore.history.push({
            fusion: STATE.speed,
            gps: STATE.gps.active ? STATE.gps.speed : 0,
            hasGps: STATE.gps.active,
            acc: rawAccMag
        });
        if (DebugCore.history.length > DebugCore.maxHistory) DebugCore.history.shift();

        DebugCore.drawSparkline();
    },

    drawSparkline: () => {
        const ctx = DebugCore.ctx;
        if (!ctx) return;
        const w = DebugCore.canvas.width;
        const h = DebugCore.canvas.height;
        const data = DebugCore.history;

        ctx.clearRect(0, 0, w, h);
        if (data.length < 2) return;

        // Scale Y: Max speed * 1.2
        const maxVal = Math.max(...data.map(d => Math.max(d.fusion, d.gps))) * 1.2 || 10;
        const scaleX = w / (DebugCore.maxHistory - 1);
        const scaleY = h / maxVal;

        // Helper to map coordinates
        const getX = (i) => i * scaleX;
        const getY = (val) => h - (val * scaleY);

        // Draw GPS (Blue)
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); // Dashed for GPS
        for (let i = 0; i < data.length; i++) {
            // 只在有 GPS 信号时绘制，或者绘制 0
            const y = getY(data[i].gps);
            if (i === 0) ctx.moveTo(getX(i), y);
            else ctx.lineTo(getX(i), y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Fusion (Green)
        ctx.beginPath();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        for (let i = 0; i < data.length; i++) {
            const y = getY(data[i].fusion);
            if (i === 0) ctx.moveTo(getX(i), y);
            else ctx.lineTo(getX(i), y);
        }
        ctx.stroke();

        // Draw Accel Magnitude (Red, scaled down visually or separate axis?)
        // Let's just draw it at bottom as activity indicator
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < data.length; i++) {
            // Scale Accel: 1g is roughly 1/4 height
            const y = h - (data[i].acc * (h/20));
            if (i === 0) ctx.moveTo(getX(i), y);
            else ctx.lineTo(getX(i), y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }
};
