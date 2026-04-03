/**
 * WaveformRenderer - 波形绘制模块
 * 负责在 Canvas 上绘制音频波形
 */
class WaveformRenderer {
    constructor() {
        this.defaultOptions = {
            waveColor: '#4a90d9',
            backgroundColor: '#0d1b2a',
            progressColor: '#6ab0ff',
            barWidth: 2,
            barGap: 1,
            barRadius: 1
        };
    }

    /**
     * 绘制波形
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {AudioBuffer} audioBuffer - 音频缓冲
     * @param {Object} options - 绘制选项
     */
    draw(canvas, audioBuffer, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const ctx = canvas.getContext('2d');
        
        // 设置画布实际尺寸
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const width = rect.width;
        const height = rect.height;
        
        // 清空画布
        ctx.fillStyle = opts.backgroundColor;
        ctx.fillRect(0, 0, width, height);
        
        // 获取音频数据
        const channelData = this.getAverageChannelData(audioBuffer);
        
        // 计算每个柱子代表的采样数
        const barCount = Math.floor(width / (opts.barWidth + opts.barGap));
        const samplesPerBar = Math.floor(channelData.length / barCount);
        
        // 绘制波形柱
        ctx.fillStyle = opts.waveColor;
        
        for (let i = 0; i < barCount; i++) {
            const startSample = i * samplesPerBar;
            const endSample = startSample + samplesPerBar;
            
            // 计算该区间的最大振幅
            let max = 0;
            for (let j = startSample; j < endSample && j < channelData.length; j++) {
                const abs = Math.abs(channelData[j]);
                if (abs > max) max = abs;
            }
            
            // 计算柱子高度
            const barHeight = Math.max(2, max * height * 0.9);
            const x = i * (opts.barWidth + opts.barGap);
            const y = (height - barHeight) / 2;
            
            // 绘制圆角矩形
            this.drawRoundedRect(ctx, x, y, opts.barWidth, barHeight, opts.barRadius);
        }
    }

    /**
     * 绘制带选区的波形
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {AudioBuffer} audioBuffer - 音频缓冲
     * @param {number} startPercent - 选区开始百分比 (0-1)
     * @param {number} endPercent - 选区结束百分比 (0-1)
     * @param {Object} options - 绘制选项
     */
    drawWithSelection(canvas, audioBuffer, startPercent, endPercent, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const ctx = canvas.getContext('2d');
        
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const width = rect.width;
        const height = rect.height;
        
        ctx.fillStyle = opts.backgroundColor;
        ctx.fillRect(0, 0, width, height);
        
        const channelData = this.getAverageChannelData(audioBuffer);
        const barCount = Math.floor(width / (opts.barWidth + opts.barGap));
        const samplesPerBar = Math.floor(channelData.length / barCount);
        
        const selectionStart = Math.floor(startPercent * barCount);
        const selectionEnd = Math.floor(endPercent * barCount);
        
        for (let i = 0; i < barCount; i++) {
            const startSample = i * samplesPerBar;
            const endSample = startSample + samplesPerBar;
            
            let max = 0;
            for (let j = startSample; j < endSample && j < channelData.length; j++) {
                const abs = Math.abs(channelData[j]);
                if (abs > max) max = abs;
            }
            
            const barHeight = Math.max(2, max * height * 0.9);
            const x = i * (opts.barWidth + opts.barGap);
            const y = (height - barHeight) / 2;
            
            // 选区内使用高亮颜色
            if (i >= selectionStart && i <= selectionEnd) {
                ctx.fillStyle = opts.progressColor;
            } else {
                ctx.fillStyle = opts.waveColor;
            }
            
            this.drawRoundedRect(ctx, x, y, opts.barWidth, barHeight, opts.barRadius);
        }
    }

    /**
     * 获取所有声道的平均数据
     * @param {AudioBuffer} audioBuffer - 音频缓冲
     * @returns {Float32Array}
     */
    getAverageChannelData(audioBuffer) {
        const channels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const result = new Float32Array(length);
        
        for (let channel = 0; channel < channels; channel++) {
            const data = audioBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                result[i] += data[i] / channels;
            }
        }
        
        return result;
    }

    /**
     * 绘制圆角矩形
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} radius - 圆角半径
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        if (radius === 0) {
            ctx.fillRect(x, y, width, height);
            return;
        }
        
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * 根据画布点击位置计算时间
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {number} clientX - 点击的X坐标
     * @param {number} duration - 音频总时长
     * @returns {number} 时间（秒）
     */
    getTimeFromPosition(canvas, clientX, duration) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        return percent * duration;
    }

    /**
     * 根据时间计算画布位置百分比
     * @param {number} time - 时间（秒）
     * @param {number} duration - 总时长
     * @returns {number} 百分比 (0-1)
     */
    getPositionFromTime(time, duration) {
        return Math.max(0, Math.min(1, time / duration));
    }
}

// 创建全局实例
window.waveformRenderer = new WaveformRenderer();
