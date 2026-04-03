/**
 * AudioEngine - 音频处理核心模块
 * 负责音频的加载、解码、剪切、合并、均衡器等操作
 */
class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.equalizer = {
      lowGain: 0,
      midGain: 0,
      highGain: 0,
      lowFilter: null,
      midFilter: null,
      highFilter: null,
    };
    this.initAudioContext();
  }

  /**
   * 初始化 AudioContext
   */
  initAudioContext() {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
    } catch (error) {
      console.error("Web Audio API 不支持:", error);
      throw new Error("您的浏览器不支持 Web Audio API");
    }
  }

  /**
   * 确保 AudioContext 处于运行状态
   */
  async ensureContextRunning() {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * 从文件加载音频并解码
   * @param {File} file - 音频文件
   * @returns {Promise<AudioBuffer>}
   */
  async loadAudioFile(file) {
    await this.ensureContextRunning();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const audioBuffer =
            await this.audioContext.decodeAudioData(arrayBuffer);
          resolve(audioBuffer);
        } catch (error) {
          reject(new Error("音频解码失败，请确保文件格式正确"));
        }
      };

      reader.onerror = () => {
        reject(new Error("文件读取失败"));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 剪切音频
   * @param {AudioBuffer} buffer - 原始音频缓冲
   * @param {number} startTime - 开始时间（秒）
   * @param {number} endTime - 结束时间（秒）
   * @returns {AudioBuffer}
   */
  cutAudio(buffer, startTime, endTime) {
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;

    // 计算采样点位置
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const length = endSample - startSample;

    if (length <= 0) {
      throw new Error("无效的时间范围");
    }

    // 创建新的 AudioBuffer
    const newBuffer = this.audioContext.createBuffer(
      channels,
      length,
      sampleRate,
    );

    // 复制数据
    for (let channel = 0; channel < channels; channel++) {
      const oldData = buffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        newData[i] = oldData[startSample + i];
      }
    }

    return newBuffer;
  }

  /**
   * 顺序拼接两个音频
   * @param {AudioBuffer} buffer1 - 第一个音频
   * @param {AudioBuffer} buffer2 - 第二个音频
   * @returns {AudioBuffer}
   */
  concatAudio(buffer1, buffer2) {
    // 使用较高的采样率
    const sampleRate = Math.max(buffer1.sampleRate, buffer2.sampleRate);
    const channels = Math.max(
      buffer1.numberOfChannels,
      buffer2.numberOfChannels,
    );

    // 重采样（如果需要）
    const resampled1 = this.resampleBuffer(buffer1, sampleRate, channels);
    const resampled2 = this.resampleBuffer(buffer2, sampleRate, channels);

    const totalLength = resampled1.length + resampled2.length;
    const newBuffer = this.audioContext.createBuffer(
      channels,
      totalLength,
      sampleRate,
    );

    for (let channel = 0; channel < channels; channel++) {
      const newData = newBuffer.getChannelData(channel);
      const data1 = resampled1.getChannelData(
        Math.min(channel, resampled1.numberOfChannels - 1),
      );
      const data2 = resampled2.getChannelData(
        Math.min(channel, resampled2.numberOfChannels - 1),
      );

      // 复制第一个音频
      newData.set(data1, 0);
      // 复制第二个音频
      newData.set(data2, resampled1.length);
    }

    return newBuffer;
  }

  /**
   * 混音叠加两个音频
   * @param {AudioBuffer} buffer1 - 第一个音频
   * @param {AudioBuffer} buffer2 - 第二个音频
   * @returns {AudioBuffer}
   */
  mixAudio(buffer1, buffer2) {
    const sampleRate = Math.max(buffer1.sampleRate, buffer2.sampleRate);
    const channels = Math.max(
      buffer1.numberOfChannels,
      buffer2.numberOfChannels,
    );

    // 重采样
    const resampled1 = this.resampleBuffer(buffer1, sampleRate, channels);
    const resampled2 = this.resampleBuffer(buffer2, sampleRate, channels);

    const maxLength = Math.max(resampled1.length, resampled2.length);
    const newBuffer = this.audioContext.createBuffer(
      channels,
      maxLength,
      sampleRate,
    );

    for (let channel = 0; channel < channels; channel++) {
      const newData = newBuffer.getChannelData(channel);
      const data1 = resampled1.getChannelData(
        Math.min(channel, resampled1.numberOfChannels - 1),
      );
      const data2 = resampled2.getChannelData(
        Math.min(channel, resampled2.numberOfChannels - 1),
      );

      for (let i = 0; i < maxLength; i++) {
        const sample1 = i < data1.length ? data1[i] : 0;
        const sample2 = i < data2.length ? data2[i] : 0;
        // 混音并防止削波
        newData[i] = Math.max(-1, Math.min(1, (sample1 + sample2) * 0.7));
      }
    }

    return newBuffer;
  }

  /**
   * 重采样音频缓冲
   * @param {AudioBuffer} buffer - 原始缓冲
   * @param {number} targetSampleRate - 目标采样率
   * @param {number} targetChannels - 目标声道数
   * @returns {AudioBuffer}
   */
  resampleBuffer(buffer, targetSampleRate, targetChannels) {
    if (
      buffer.sampleRate === targetSampleRate &&
      buffer.numberOfChannels === targetChannels
    ) {
      return buffer;
    }

    const ratio = buffer.sampleRate / targetSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const newBuffer = this.audioContext.createBuffer(
      targetChannels,
      newLength,
      targetSampleRate,
    );

    for (let channel = 0; channel < targetChannels; channel++) {
      const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
      const oldData = buffer.getChannelData(sourceChannel);
      const newData = newBuffer.getChannelData(channel);

      for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, oldData.length - 1);
        const fraction = srcIndex - srcIndexFloor;

        // 线性插值
        newData[i] =
          oldData[srcIndexFloor] * (1 - fraction) +
          oldData[srcIndexCeil] * fraction;
      }
    }

    return newBuffer;
  }

  /**
   * 获取音频时长格式化字符串
   * @param {number} seconds - 秒数
   * @returns {string}
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  }

  /**
   * 获取音频信息
   * @param {AudioBuffer} buffer - 音频缓冲
   * @returns {Object}
   */
  getAudioInfo(buffer) {
    return {
      duration: buffer.duration,
      durationFormatted: this.formatTime(buffer.duration),
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      length: buffer.length,
    };
  }

  /**
   * 创建三段均衡器滤波器链
   * @returns {Object} 包含三个滤波器的对象
   */
  createEqualizer() {
    const ctx = this.audioContext;

    this.equalizer.lowFilter = ctx.createBiquadFilter();
    this.equalizer.lowFilter.type = "lowshelf";
    this.equalizer.lowFilter.frequency.value = 320;
    this.equalizer.lowFilter.gain.value = this.equalizer.lowGain;

    this.equalizer.midFilter = ctx.createBiquadFilter();
    this.equalizer.midFilter.type = "peaking";
    this.equalizer.midFilter.frequency.value = 1000;
    this.equalizer.midFilter.Q.value = 1;
    this.equalizer.midFilter.gain.value = this.equalizer.midGain;

    this.equalizer.highFilter = ctx.createBiquadFilter();
    this.equalizer.highFilter.type = "highshelf";
    this.equalizer.highFilter.frequency.value = 3200;
    this.equalizer.highFilter.gain.value = this.equalizer.highGain;

    this.equalizer.lowFilter.connect(this.equalizer.midFilter);
    this.equalizer.midFilter.connect(this.equalizer.highFilter);

    return {
      input: this.equalizer.lowFilter,
      output: this.equalizer.highFilter,
      lowFilter: this.equalizer.lowFilter,
      midFilter: this.equalizer.midFilter,
      highFilter: this.equalizer.highFilter,
    };
  }

  /**
   * 设置低频增益
   * @param {number} gain - 增益值（dB），范围 -12 到 +12
   */
  setLowGain(gain) {
    this.equalizer.lowGain = Math.max(-12, Math.min(12, gain));
    if (this.equalizer.lowFilter) {
      this.equalizer.lowFilter.gain.value = this.equalizer.lowGain;
    }
  }

  /**
   * 设置中频增益
   * @param {number} gain - 增益值（dB），范围 -12 到 +12
   */
  setMidGain(gain) {
    this.equalizer.midGain = Math.max(-12, Math.min(12, gain));
    if (this.equalizer.midFilter) {
      this.equalizer.midFilter.gain.value = this.equalizer.midGain;
    }
  }

  /**
   * 设置高频增益
   * @param {number} gain - 增益值（dB），范围 -12 到 +12
   */
  setHighGain(gain) {
    this.equalizer.highGain = Math.max(-12, Math.min(12, gain));
    if (this.equalizer.highFilter) {
      this.equalizer.highFilter.gain.value = this.equalizer.highGain;
    }
  }

  /**
   * 重置均衡器到默认值
   */
  resetEqualizer() {
    this.setLowGain(0);
    this.setMidGain(0);
    this.setHighGain(0);
  }

  /**
   * 获取当前均衡器设置
   * @returns {Object} 包含 low, mid, high 增益值
   */
  getEqualizerSettings() {
    return {
      low: this.equalizer.lowGain,
      mid: this.equalizer.midGain,
      high: this.equalizer.highGain,
    };
  }
}

// 创建全局实例
window.audioEngine = new AudioEngine();
