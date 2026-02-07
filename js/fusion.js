import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';
import { DebugCore } from './debug.js';

export class FusionEngine {
    constructor() {
        this.lastTime = performance.now();
        this.isStaticCounter = 0;
        this.lastGpsSpeed = 0;
        this.lastGpsTime = 0;
        // 初始化场景参数
        this.applyScenarioConfig(CONFIG.mode);
    }

    /**
     * 应用场景算法配置
     * @param {string} scenarioName - 场景名称: 'vehicle', 'pedestrian', 'tunnel'
     */
    applyScenarioConfig(scenarioName) {
        const scenario = CONFIG.scenarios[scenarioName];
        if (!scenario) {
            console.error(`未知场景: ${scenarioName}`);
            return;
        }

        // 更新全局配置
        CONFIG.mode = scenarioName;
        STATE.currentScenario = scenarioName;

        // 应用卡尔曼滤波参数
        STATE.kalman.q = scenario.kalman.q;
        STATE.kalman.r = scenario.kalman.r;
        // 只在场景切换时重置P，避免影响运行中的融合
        if (STATE.speed < 0.5) {
            STATE.kalman.p = scenario.kalman.initialP;
        }

        // 应用ZUPT参数
        CONFIG.accelThreshold = scenario.zupt.accelThreshold;

        // 缓存场景参数供update()使用
        this.scenarioParams = scenario;

        console.log(`场景切换: ${scenario.name}`);
    }

    // 一维卡尔曼滤波：融合 GPS 观测值 和 加速度积分预测值
    update(currentTime) {
        const dt = (currentTime - this.lastTime) / 1000; // seconds
        this.lastTime = currentTime;

        const gpsAge = (Date.now() - STATE.gps.timestamp) / 1000;

        if (dt <= 0 || dt > 1) {
            requestAnimationFrame(this.update.bind(this));
            return;
        }

        // 1. 预处理与注入
        const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
        let accMag = 0;
        let signedAcc = 0;
        let alignmentRaw = 0;
        let alignmentScore = 0;
        let forwardAngleDeg = STATE.motion.forwardAngle || 0;
        if (STATE.motion.active) {
            // --- 动态重力投影 ---
            const { ax, ay, az, gx, gy, gz } = STATE.motion;
            const gSq = gx * gx + gy * gy + gz * gz;
            let hx = 0, hy = 0, hz = 0;

            if (gSq > 0.1) {
                // 将加速度投影到重力方向 (垂直分量)
                const dot = ax * gx + ay * gy + az * gz;
                const scale = dot / gSq;
                const vx = scale * gx;
                const vy = scale * gy;
                const vz = scale * gz;

                // 水平分量 = 原始加速度 - 垂直分量
                hx = ax - vx;
                hy = ay - vy;
                hz = az - vz;

                accMag = Math.sqrt(hx * hx + hy * hy + hz * hz);
            } else {
                hx = ax; hy = ay; hz = az;
                accMag = Math.sqrt(ax * ax + ay * ay + az * az);
            }

            // --- 方向对齐程度 & 前进角度 ---
            if (accMag > 0.001) {
                const invMag = 1 / accMag;
                const nx = hx * invMag;
                const ny = hy * invMag;
                const nz = hz * invMag;
                alignmentRaw = clamp(
                    nx * STATE.motion.forwardVector.x + ny * STATE.motion.forwardVector.y + nz * STATE.motion.forwardVector.z,
                    -1,
                    1
                );
                alignmentScore = Math.max(0, alignmentRaw);
            }

            forwardAngleDeg = (Math.atan2(STATE.motion.forwardVector.y, STATE.motion.forwardVector.x) * 180 / Math.PI + 360) % 360;
            STATE.motion.forwardAlignment = alignmentScore;
            STATE.motion.forwardAngle = forwardAngleDeg;

            // --- 前进方向学习与投影 ---
            // 只有在有一定加速度且 GPS 有效时学习方向
            const isGpsTrustworthy = STATE.gps.active && gpsAge < 2.0 && STATE.gps.accuracy < 30 && STATE.gps.speed > 3;
            let gpsAcc = 0;
            if (STATE.gps.timestamp !== this.lastGpsTime && this.lastGpsTime > 0) {
                const dtGps = (STATE.gps.timestamp - this.lastGpsTime) / 1000;
                if (dtGps > 0) {
                    gpsAcc = (STATE.gps.speed - this.lastGpsSpeed) / dtGps;
                }
            }

            if (isGpsTrustworthy && accMag > 0.5) {
                // 如果 GPS 速度在增加，当前的水平加速度方向就是前进方向
                if (gpsAcc > 0.2) {
                    const alpha = 0.05; // 学习率，缓慢更新前进方向向量
                    STATE.motion.forwardVector.x = (1 - alpha) * STATE.motion.forwardVector.x + alpha * (hx / accMag);
                    STATE.motion.forwardVector.y = (1 - alpha) * STATE.motion.forwardVector.y + alpha * (hy / accMag);
                    STATE.motion.forwardVector.z = (1 - alpha) * STATE.motion.forwardVector.z + alpha * (hz / accMag);
                    
                    // 归一化
                    const fMag = Math.sqrt(STATE.motion.forwardVector.x**2 + STATE.motion.forwardVector.y**2 + STATE.motion.forwardVector.z**2);
                    if (fMag > 0) {
                        STATE.motion.forwardVector.x /= fMag;
                        STATE.motion.forwardVector.y /= fMag;
                        STATE.motion.forwardVector.z /= fMag;
                    }
                }
            }

            // 计算沿前进方向的投影速度（带符号）
            signedAcc = accMag * alignmentRaw;

            // 速度增加时扩大 FOV，减少侧向移动导致的负加速度倾向
            if (accMag > 0.001) {
                const angleDeg = Math.acos(clamp(alignmentRaw, -1, 1)) * 180 / Math.PI;
                const forwardCone = (isGpsTrustworthy && gpsAcc > 0.2) ? 120 : 85;
                const backwardCone = 55;
                if (angleDeg > forwardCone && angleDeg < (180 - backwardCone)) {
                    signedAcc = 0;
                }
            }

            // 更新 GPS 缓存
            if (STATE.gps.timestamp !== this.lastGpsTime) {
                this.lastGpsSpeed = STATE.gps.speed;
                this.lastGpsTime = STATE.gps.timestamp;
            }

            // --- 方差防抖算法 ---
            const history = STATE.motion.accHistory;
            history.push(accMag);
            if (history.length > 20) history.shift();

            if (history.length > 5) {
                const mean = history.reduce((a, b) => a + b, 0) / history.length;
                const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;

                // 使用场景参数中的方差阈值
                if (variance > this.scenarioParams.accelVarianceThreshold) {
                    signedAcc = 0;
                }
            }

            // 基础噪声门限 (对投影后的加速度生效)
            if (Math.abs(signedAcc) < CONFIG.accelThreshold) signedAcc = 0;
        }

        // Debug Hook: 注入或覆盖加速度
        if (CONFIG.debug) {
            signedAcc = DebugCore.getInjectedAccel(signedAcc);
            accMag = Math.abs(signedAcc);
        }

        // 2. 场景逻辑：ZUPT (零速更新)
        // 使用原始合力 accMag 来判断设备是否处于静止状态
        if (accMag < CONFIG.accelThreshold) {
            this.isStaticCounter += dt;
        } else {
            this.isStaticCounter = 0;
        }

        // 3. 卡尔曼滤波 - 预测阶段 (Prediction)
        // x = x + signedAcc * dt
        STATE.kalman.x += signedAcc * dt;
        STATE.kalman.p += STATE.kalman.q;

        // 4. 卡尔曼滤波 - 更新阶段 (Correction)
        // 计算 GPS 状态，考虑 Debug Hook 的强制屏蔽
        // 验证GPS数据有效性：需同时满足活跃、实时性且精度在可接受范围内(<=98m)
        let isGpsValid = STATE.gps.active && gpsAge < 2.0 && STATE.gps.accuracy <= 98;

        if (CONFIG.debug && DebugCore.shouldBlockGPS()) {
            isGpsValid = false; // 强制隧道模式
        }

        let currentK = 0; // 用于调试显示的 K 值

        if (isGpsValid) {
            // 动态调整 R (观测噪声)：GPS精度越差，R越大，越不信任GPS
            // 计算逻辑：R 为观测方差。假设速度标准差与位置精度成正比（约15%）
            // 结果：精度 10m -> R=2.25, 精度 30m -> R=20.25, 精度 90m -> R=182.25
            const baseR = this.scenarioParams.kalman.r;
            STATE.kalman.r = Math.max(baseR, Math.pow(STATE.gps.accuracy * 0.15, 2));

            const z = STATE.gps.speed; // 观测值
            const k = STATE.kalman.p / (STATE.kalman.p + STATE.kalman.r); // 卡尔曼增益
            currentK = k;
            STATE.kalman.k = k;

            STATE.kalman.x = STATE.kalman.x + k * (z - STATE.kalman.x);
            STATE.kalman.p = (1 - k) * STATE.kalman.p;

            UI.updateFusionBadge("修正中", "text-green-400");
        } else {
            // GPS 不可用 - 使用场景参数中的衰减率
            // 当精度非常低时也使用 tunnelRate
            const isLowAccuracy = STATE.gps.accuracy > 90;
            const useTunnelDecay = CONFIG.mode === 'tunnel' || DebugCore.flags.forceTunnel || isLowAccuracy || isGpsValid;

            const decayRate = useTunnelDecay
                ? this.scenarioParams.decay.tunnelRate
                : this.scenarioParams.decay.normalRate;

            STATE.kalman.x *= decayRate;

            if (isLowAccuracy || !isGpsValid) {
                UI.updateFusionBadge("信号弱", "text-[var(--warn-color)]");
            } else if (CONFIG.mode === 'tunnel' && gpsAge < 10 && !DebugCore.flags.forceTunnel) {
                UI.updateFusionBadge("隧道模式", "text-[var(--warn-color)]");
            } else if (DebugCore.flags.forceTunnel) {
                UI.updateFusionBadge("调试: 隧道模拟", "text-[var(--warn-color)]");
            } else {
                UI.updateFusionBadge("信号丢失", "text-[var(--danger-color)]");
            }
        }

        // 5. 应用 ZUPT 强制归零 - 使用场景参数
        const stopTimeThreshold = this.scenarioParams.zupt.stopTimeThreshold;
        const stopSpeedThreshold = this.scenarioParams.zupt.stopSpeedThreshold;
        
        if (this.isStaticCounter > stopTimeThreshold && STATE.kalman.x < stopSpeedThreshold) {
            STATE.kalman.x = 0;
            UI.updateFusionBadge("静止", "text-[var(--text-color)]/60");
        }

        // 6. 更新全局状态
        STATE.speed = Math.max(0, STATE.kalman.x);
        if (STATE.speed > 0.5) {
            STATE.distance += STATE.speed * dt;
        }
        if (STATE.speed > STATE.maxSpeed) STATE.maxSpeed = STATE.speed;

        // 7. 渲染与调试数据导出
        UI.render();

        // 传递投影后的有符号加速度signedAcc和原始三轴加速度
        DebugCore.updateStats(
            dt,
            gpsAge,
            currentK,
            isGpsValid ? STATE.gps.speed : 0,
            STATE.motion.forwardAlignment,
            STATE.motion.forwardAngle
        );

        requestAnimationFrame(this.update.bind(this));
    }

    start() {
        this.update(performance.now());
    }
}
