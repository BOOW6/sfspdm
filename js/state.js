export const STATE = {
    speed: 0, // 当前融合速度 m/s
    maxSpeed: 0, // m/s
    distance: 0, // meters
    lastUpdate: 0,
    gps: {
        active: false,
        speed: 0,
        accuracy: 9999, // meters
        timestamp: 0,
        lat: null,
        lon: null
    },
    motion: {
        active: false,
        ax: 0, ay: 0, az: 0, // linear acceleration
        gx: 0, gy: 0, gz: 0, // gravity vector (filtered)
        timestamp: 0,
        accHistory: [] // 用于方差防抖
    },
    kalman: {
        x: 0, // 估计值 (速度)
        p: 1, // 估计误差协方差
        q: 0.1, // 过程噪声 (加速度计的不确定性)
        r: 2.0,  // 观测噪声 (GPS的不确定性)
        k: 0  // 增益 (仅用于调试显示)
    }
};
