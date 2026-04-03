/**
 * AudioExporter - 音频导出模块
 * 负责将 AudioBuffer 导出为 WAV 或 MP3 格式
 */
class AudioExporter {
    constructor() {
        this.lamejsLoaded = typeof lamejs !== 'undefined';
    }

    /**
     * 导出音频
     * @param {AudioBuffer} buffer - 音频缓冲
     * @param {string} format - 格式 ('wav' 或 'mp3')
     * @param {string} filename - 文件名（不含扩展名）
     * @param {Function} onProgress - 进度回调
     */
    async export(buffer, format, filename, onProgress = null) {
        let blob;
        
        if (format === 'mp3') {
            if (!this.lamejsLoaded) {
                throw new Error('MP3 编码库未加载，请使用 WAV 格式');
            }
            blob = await this.encodeMP3(buffer, onProgress);
        } else {
            blob = this.encodeWAV(buffer);
        }
        
        this.downloadBlob(blob, `${filename}.${format}`);
    }

    /**
     * 编码为 WAV 格式
     * @param {AudioBuffer} buffer - 音频缓冲
     * @returns {Blob}
     */
    encodeWAV(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        // 交错声道数据
        const interleaved = this.interleaveChannels(buffer);
        
        // 转换为 16 位整数
        const samples = new Int16Array(interleaved.length);
        for (let i = 0; i < interleaved.length; i++) {
            const s = Math.max(-1, Math.min(1, interleaved[i]));
            samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // 创建 WAV 文件
        const dataLength = samples.length * 2;
        const bufferLength = 44 + dataLength;
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);
        
        // RIFF 头
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');
        
        // fmt 块
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // 块大小
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true); // 字节率
        view.setUint16(32, numChannels * bitDepth / 8, true); // 块对齐
        view.setUint16(34, bitDepth, true);
        
        // data 块
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // 写入采样数据
        const offset = 44;
        for (let i = 0; i < samples.length; i++) {
            view.setInt16(offset + i * 2, samples[i], true);
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    /**
     * 编码为 MP3 格式
     * @param {AudioBuffer} buffer - 音频缓冲
     * @param {Function} onProgress - 进度回调
     * @returns {Promise<Blob>}
     */
    async encodeMP3(buffer, onProgress = null) {
        return new Promise((resolve, reject) => {
            try {
                const channels = buffer.numberOfChannels;
                const sampleRate = buffer.sampleRate;
                const kbps = 128;
                
                const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
                const mp3Data = [];
                
                // 获取声道数据
                const left = buffer.getChannelData(0);
                const right = channels > 1 ? buffer.getChannelData(1) : left;
                
                // 转换为 16 位整数
                const leftInt = new Int16Array(left.length);
                const rightInt = new Int16Array(right.length);
                
                for (let i = 0; i < left.length; i++) {
                    leftInt[i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
                    rightInt[i] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
                }
                
                // 分块编码
                const blockSize = 1152;
                const totalBlocks = Math.ceil(leftInt.length / blockSize);
                let processedBlocks = 0;
                
                const processBlock = () => {
                    const start = processedBlocks * blockSize;
                    const end = Math.min(start + blockSize, leftInt.length);
                    
                    if (start >= leftInt.length) {
                        // 完成编码
                        const remaining = mp3encoder.flush();
                        if (remaining.length > 0) {
                            mp3Data.push(remaining);
                        }
                        
                        const blob = new Blob(mp3Data, { type: 'audio/mp3' });
                        resolve(blob);
                        return;
                    }
                    
                    const leftChunk = leftInt.subarray(start, end);
                    const rightChunk = rightInt.subarray(start, end);
                    
                    let mp3buf;
                    if (channels === 1) {
                        mp3buf = mp3encoder.encodeBuffer(leftChunk);
                    } else {
                        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                    }
                    
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                    
                    processedBlocks++;
                    
                    if (onProgress) {
                        onProgress(processedBlocks / totalBlocks);
                    }
                    
                    // 使用 setTimeout 避免阻塞 UI
                    setTimeout(processBlock, 0);
                };
                
                processBlock();
                
            } catch (error) {
                reject(new Error('MP3 编码失败: ' + error.message));
            }
        });
    }

    /**
     * 交错声道数据
     * @param {AudioBuffer} buffer - 音频缓冲
     * @returns {Float32Array}
     */
    interleaveChannels(buffer) {
        const channels = buffer.numberOfChannels;
        const length = buffer.length;
        
        if (channels === 1) {
            return buffer.getChannelData(0);
        }
        
        const result = new Float32Array(length * channels);
        const channelData = [];
        
        for (let c = 0; c < channels; c++) {
            channelData.push(buffer.getChannelData(c));
        }
        
        for (let i = 0; i < length; i++) {
            for (let c = 0; c < channels; c++) {
                result[i * channels + c] = channelData[c][i];
            }
        }
        
        return result;
    }

    /**
     * 写入字符串到 DataView
     * @param {DataView} view - DataView 对象
     * @param {number} offset - 偏移量
     * @param {string} string - 字符串
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * 下载 Blob 文件
     * @param {Blob} blob - Blob 对象
     * @param {string} filename - 文件名
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// 创建全局实例
window.audioExporter = new AudioExporter();
