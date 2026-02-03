import { Logger } from './logger.js';
import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';
import { DebugCore } from './debug.js';
import { FusionEngine } from './fusion.js';

const modulename = "hardware";

export const Hardware = {
    init: async () => {
        Logger.log(modulename, "正在初始化传感器...", "info");

        // Debug Init - Pass callback to avoid circular dependency import issue in debug.js
        DebugCore.init((gpsData) => {
             Hardware.handleGPS(gpsData);
        });

        Hardware.requestWakeLock();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                Hardware.requestWakeLock();
                Logger.log(modulename, "应用回到前台，重新激活 Wake Lock");
            } else {
                Logger.log(modulename, "警告: 应用在后台运行，传感器可能暂停", "warn");
            }
        });

        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                Hardware.handleGPS,
                Hardware.handleGPSError,
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );
        } else {
            Logger.log(modulename, "不支持 Geolocation API", "error");
            UI.setStatus('gps', 'error');
        }

        if (typeof DeviceMotionEvent !== 'undefined') {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                // iOS 13+ requires user interaction. This should probably called from a click handler.
                // The main.js will attach this init to a button click, so it is safe.
                try {
                    const permissionState = await DeviceMotionEvent.requestPermission();
                    if (permissionState === 'granted') {
                        window.addEventListener('devicemotion', Hardware.handleMotion);
                        Logger.log(modulename, "已获取加速度计权限");
                    } else {
                        Logger.log(modulename, "用户拒绝了加速度计权限", "error");
                        UI.setStatus('motion', 'error');
                    }
                } catch (e) {
                    Logger.log(modulename, "请求权限失败: " + e, "error");
                }
            } else {
                window.addEventListener('devicemotion', Hardware.handleMotion);
                Logger.log(modulename, "开始监听加速度计");
            }
        } else {
            Logger.log(modulename, "不支持 DeviceMotionEvent", "error");
            UI.setStatus('motion', 'error');
        }

        const engine = new FusionEngine();
        engine.start();

        const overlay = document.getElementById('permission-overlay');
        if(overlay) overlay.classList.add('hidden');
    },

    requestWakeLock: async () => {
        try {
            if ('wakeLock' in navigator) {
                CONFIG.wakeLock = await navigator.wakeLock.request('screen');
                UI.setStatus('wake', 'active');
                Logger.log(modulename, "Wake Lock 已激活");
            }
        } catch (err) {
            UI.setStatus('wake', 'error');
            Logger.log(modulename, `Wake Lock 失败: ${err.name}, ${err.message}`, "warn");
        }
    },

    handleGPS: (position) => {
        const { coords, timestamp } = position;

        STATE.gps.active = true;
        STATE.gps.lat = coords.latitude;
        STATE.gps.lon = coords.longitude;
        STATE.gps.accuracy = coords.accuracy;
        STATE.gps.timestamp = timestamp || Date.now();
        STATE.gps.speed = coords.speed !== null ? coords.speed : 0;

        if (coords.accuracy < 20) {
            UI.setStatus('gps', 'active');
        } else if (coords.accuracy < 50) {
            UI.setStatus('gps', 'warn');
        } else {
            UI.setStatus('gps', 'warn');
            if (!CONFIG.debug) Logger.log(modulename, `GPS 信号弱: 精度 ${Math.round(coords.accuracy)}m`, "warn");
        }
    },

    handleGPSError: (err) => {
        STATE.gps.active = false;
        UI.setStatus('gps', 'error');
        Logger.log(modulename, `GPS 错误 (${err.code}): ${err.message}`, "error");
    },

    handleMotion: (event) => {
        STATE.motion.active = true;
        UI.setStatus('motion', 'active');

        const acc = event.acceleration;
        const accG = event.accelerationIncludingGravity;
        const alpha = 0.8; // 重力低通滤波系数

        // 1. 更新重力向量估算
        if (accG && accG.x !== null) {
            // 初始化
            if (STATE.motion.gx === 0 && STATE.motion.gy === 0 && STATE.motion.gz === 0) {
                 STATE.motion.gx = accG.x;
                 STATE.motion.gy = accG.y;
                 STATE.motion.gz = accG.z;
            } else {
                 STATE.motion.gx = alpha * STATE.motion.gx + (1 - alpha) * accG.x;
                 STATE.motion.gy = alpha * STATE.motion.gy + (1 - alpha) * accG.y;
                 STATE.motion.gz = alpha * STATE.motion.gz + (1 - alpha) * accG.z;
            }
        }

        // 2. 获取线性加速度 (设备坐标系)
        if (acc && acc.x !== null) {
            STATE.motion.ax = acc.x;
            STATE.motion.ay = acc.y;
            STATE.motion.az = acc.z;
        } else if (accG && accG.x !== null) {
            STATE.motion.ax = accG.x - STATE.motion.gx;
            STATE.motion.ay = accG.y - STATE.motion.gy;
            STATE.motion.az = accG.z - STATE.motion.gz;
        }

        STATE.motion.timestamp = Date.now();
    }
};
