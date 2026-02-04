import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';
import { DebugCore } from './debug.js';

export class FusionEngine {
    constructor() {
        this.lastTime = performance.now();
        this.isStaticCounter = 0;
    }

    // 一维卡尔曼滤波：融合 GPS 观测值 和 加速度积分预测值
    update(currentTime) {
        const dt = (currentTime - this.lastTime) / 1000; // seconds
        this.lastTime = currentTime;

        if (dt <= 0 || dt > 1) {
            requestAnimationFrame(this.update.bind(this));
            return;
        }

        // 1. 预处理与注入
        let accMag = 0;
        if (STATE.motion.active) {
            // --- 动态重力投影 ---
            const { ax, ay, az, gx, gy, gz } = STATE.motion;
            const gSq = gx * gx + gy * gy + gz * gz;

            if (gSq > 0.1) {
                // 将加速度投影到重力方向 (垂直分量)
                const dot = ax * gx + ay * gy + az * gz;
                const scale = dot / gSq;
                const vx = scale * gx;
                const vy = scale * gy;
                const vz = scale * gz;

                // 水平分量 = 原始加速度 - 垂直分量
                const hx = ax - vx;
                const hy = ay - vy;
                const hz = az - vz;

                accMag = Math.sqrt(hx * hx + hy * hy + hz * hz);
            } else {
                accMag = Math.sqrt(ax * ax + ay * ay + az * az);
            }

            // --- 方差防抖算法 ---
            const history = STATE.motion.accHistory;
            history.push(accMag);
            if (history.length > 20) history.shift();

            if (history.length > 5) {
                const mean = history.reduce((a, b) => a + b, 0) / history.length;
                const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;

                // 如果方差过大，认为是无效晃动或震动干扰
                // 阈值: 0.20 (约等于 (0.45 m/s^2)^2，默认值)
                //      0.81 (约等于 (0.9 m/s^2)^2)
                if (variance > 0.81) {
                    accMag = 0;
                }
            }

            // 基础噪声门限
            if (accMag < CONFIG.accelThreshold) accMag = 0;
        }
        // Debug Hook: 注入或覆盖加速度
        if (CONFIG.debug) {
            accMag = DebugCore.getInjectedAccel(accMag);
        }

        // 2. 场景逻辑：ZUPT (零速更新)
        if (accMag < CONFIG.accelThreshold) {
            this.isStaticCounter += dt;
        } else {
            this.isStaticCounter = 0;
        }

        // 3. 卡尔曼滤波 - 预测阶段 (Prediction)
        // x = x + a * dt
        // p = p + q
        STATE.kalman.x += accMag * dt;
        STATE.kalman.p += STATE.kalman.q;

        // 4. 卡尔曼滤波 - 更新阶段 (Correction)
        // 计算 GPS 状态，考虑 Debug Hook 的强制屏蔽
        const gpsAge = (Date.now() - STATE.gps.timestamp) / 1000;
        let isGpsValid = STATE.gps.active && gpsAge < 2.0;

        if (CONFIG.debug && DebugCore.shouldBlockGPS()) {
            isGpsValid = false; // 强制隧道模式
        }

        let currentK = 0; // 用于调试显示的 K 值

        if (isGpsValid) {
            // 动态调整 R (观测噪声)：GPS精度越差，R越大，越不信任GPS
            STATE.kalman.r = Math.max(1, STATE.gps.accuracy / 2);

            const z = STATE.gps.speed; // 观测值
            const k = STATE.kalman.p / (STATE.kalman.p + STATE.kalman.r); // 卡尔曼增益
            currentK = k;
            STATE.kalman.k = k;

            STATE.kalman.x = STATE.kalman.x + k * (z - STATE.kalman.x);
            STATE.kalman.p = (1 - k) * STATE.kalman.p;

            UI.updateFusionBadge("GPS修正中", "text-green-400");
        } else {
            // GPS 不可用
            if (CONFIG.mode === 'tunnel' && gpsAge < 10 && !DebugCore.flags.forceTunnel) {
                UI.updateFusionBadge("隧道模式: 惯性导航", "text-[var(--warn-color)]");
            } else if (DebugCore.flags.forceTunnel) {
                 UI.updateFusionBadge("调试: 隧道模拟中", "text-[var(--warn-color)]");
                 STATE.kalman.x *= 0.99; // 稍微快一点的衰减
            } else {
                STATE.kalman.x *= 0.98;
                UI.updateFusionBadge("信号丢失: 速度衰减", "text-[var(--danger-color)]");
            }
        }

        // 5. 应用 ZUPT 强制归零
        const stopTimeThreshold = CONFIG.mode === 'pedestrian' ? 1.0 : 2.0;
        if (this.isStaticCounter > stopTimeThreshold && STATE.kalman.x < 1.0) {
            STATE.kalman.x = 0;
            UI.updateFusionBadge("静止 (ZUPT)", "text-[var(--text-color)]/60");
        }

        // 6. 更新全局状态
        STATE.speed = Math.max(0, STATE.kalman.x);
        if (STATE.speed > 0.5) {
            STATE.distance += STATE.speed * dt;
        }
        if (STATE.speed > STATE.maxSpeed) STATE.maxSpeed = STATE.speed;

        // 7. 渲染与调试数据导出
        UI.render();

        DebugCore.updateStats(dt, gpsAge, currentK, isGpsValid ? STATE.gps.speed : 0, accMag);

        requestAnimationFrame(this.update.bind(this));
    }

    start() {
        this.update(performance.now());
    }
}
