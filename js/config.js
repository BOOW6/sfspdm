export const CONFIG = {
    unit: 'kmh', // kmh, mph, kts
    maxScale: 100,
    mode: 'vehicle', // vehicle, pedestrian, tunnel
    accelThreshold: 0.10, // m/s^2, ZUPT 静止检测阈值
    gravity: 9.81,
    wakeLock: null,
    debug: null,

    // 场景算法参数配置
    scenarios: {
        vehicle: {
            name: '车载/骑行', // ZUPT校准，适合车辆和自行车
            kalman: {
                q: 0.1,        // 过程噪声：加速度计不确定性
                r: 2.0,        // 观测噪声：GPS不确定性
                initialP: 1.0  // 初始估计误差协方差
            },
            zupt: {
                accelThreshold: 0.10,   // 加速度门限 (m/s²)
                stopTimeThreshold: 2.0, // 静止时间门限 (秒)
                stopSpeedThreshold: 1.0 // 停止速度门限 (m/s)
            },
            decay: {
                normalRate: 0.99996,    // GPS无回报时衰减率
                tunnelRate: 0.99999     // 隧道模式衰减率
            },
            accelVarianceThreshold: 0.81    // 加速度方差阈值，过滤震动
        },
        pedestrian: {
            name: '步行/跑步', // 高灵敏度，适合徒步和跑步
            kalman: {
                q: 0.15,        // 更高的过程噪声，响应更快
                r: 3.0,         // 更高的观测噪声，GPS信任度降低
                initialP: 1.5
            },
            zupt: {
                accelThreshold: 0.08,   // 更低的门限，更灵敏
                stopTimeThreshold: 1.0, // 更短的静止判定时间
                stopSpeedThreshold: 0.5 // 更低的停止速度门限
            },
            decay: {
                normalRate: 0.99992,    // 更快的衰减
                tunnelRate: 0.99999
            },
            accelVarianceThreshold: 99999.99    // 容忍振动
        },
        tunnel: {
            name: '隧道模式', // 强积分补偿，GPS信号弱时保持精度
            kalman: {
                q: 0.05,        // 更低的过程噪声，更平滑
                r: 10.0,        // 很高的观测噪声，强依赖惯性
                initialP: 1.5
            },
            zupt: {
                accelThreshold: 0.12,   // 稍高的门限，减少误触发
                stopTimeThreshold: 3.0, // 更长的静止判定时间
                stopSpeedThreshold: 0.1
            },
            decay: {
                normalRate: 0.99999,    // 非常慢的衰减，保持惯性导航
                tunnelRate: 1.0         // 隧道模式不衰减
            },
            accelVarianceThreshold: 99999.99    // 容忍振动
        }
    }
};
