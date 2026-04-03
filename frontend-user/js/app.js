/**
 * AudioEditorApp - 音频编辑器主应用
 * 整合所有模块，处理业务逻辑
 */
class AudioEditorApp {
    constructor() {
        // 剪切面板状态
        this.cutState = {
            audioBuffer: null,
            fileName: '',
            isPlaying: false,
            sourceNode: null,
            startTime: 0,
            pauseTime: 0,
            animationFrame: null
        };

        // 合并面板状态
        this.mergeState = {
            audio1: { buffer: null, fileName: '' },
            audio2: { buffer: null, fileName: '' },
            mergedBuffer: null,
            isPlaying: false,
            sourceNode: null,
            startTime: 0,
            pauseTime: 0,
            animationFrame: null
        };
    }

    /**
     * 初始化应用
     */
    init() {
        window.uiManager.init();
        this.bindTabEvents();
        this.bindCutPanelEvents();
        this.bindMergePanelEvents();
        this.bindWindowEvents();
        
        console.log('音频编辑器初始化完成');
    }

    /**
     * 绑定标签页切换事件
     */
    bindTabEvents() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const panels = document.querySelectorAll('.panel');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                // 停止所有播放
                this.stopCutPlayback();
                this.stopMergePlayback();
                
                // 切换标签
                tabBtns.forEach(b => b.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(`${tabId}-panel`).classList.add('active');
            });
        });
    }

    /**
     * 绑定剪切面板事件
     */
    bindCutPanelEvents() {
        const uploadArea = document.getElementById('cut-upload-area');
        const fileInput = document.getElementById('cut-file-input');
        const canvas = document.getElementById('cut-waveform');
        const playBtn = document.getElementById('cut-play-btn');
        const stopBtn = document.getElementById('cut-stop-btn');
        const previewBtn = document.getElementById('cut-preview-btn');
        const exportBtn = document.getElementById('cut-export-btn');
        const startTimeInput = document.getElementById('cut-start-time');
        const endTimeInput = document.getElementById('cut-end-time');

        // 文件上传
        window.uiManager.setupDropZone(uploadArea, fileInput, (file) => {
            this.loadCutAudio(file);
        });

        // 波形拖拽选择
        window.uiManager.setupWaveformDrag(canvas, (start, end) => {
            if (!this.cutState.audioBuffer) return;
            
            const duration = this.cutState.audioBuffer.duration;
            startTimeInput.value = (start * duration).toFixed(3);
            endTimeInput.value = (end * duration).toFixed(3);
            
            this.updateCutSelection();
        });

        // 时间输入变化
        startTimeInput.addEventListener('input', () => this.updateCutSelection());
        endTimeInput.addEventListener('input', () => this.updateCutSelection());

        // 播放控制
        playBtn.addEventListener('click', () => this.toggleCutPlayback());
        stopBtn.addEventListener('click', () => this.stopCutPlayback());

        // 预览选区
        previewBtn.addEventListener('click', () => this.previewCutSelection());

        // 导出
        exportBtn.addEventListener('click', () => this.exportCutAudio());
    }

    /**
     * 绑定合并面板事件
     */
    bindMergePanelEvents() {
        // 音频1上传
        const upload1 = document.getElementById('merge-upload-1');
        const input1 = document.getElementById('merge-file-1');
        const remove1 = document.getElementById('merge-remove-1');

        window.uiManager.setupDropZone(upload1, input1, (file) => {
            this.loadMergeAudio(1, file);
        });

        remove1.addEventListener('click', () => this.removeMergeAudio(1));

        // 音频2上传
        const upload2 = document.getElementById('merge-upload-2');
        const input2 = document.getElementById('merge-file-2');
        const remove2 = document.getElementById('merge-remove-2');

        window.uiManager.setupDropZone(upload2, input2, (file) => {
            this.loadMergeAudio(2, file);
        });

        remove2.addEventListener('click', () => this.removeMergeAudio(2));

        // 播放控制
        document.getElementById('merge-play-btn').addEventListener('click', () => {
            this.toggleMergePlayback();
        });

        document.getElementById('merge-stop-btn').addEventListener('click', () => {
            this.stopMergePlayback();
        });

        // 预览和导出
        document.getElementById('merge-preview-btn').addEventListener('click', () => {
            this.previewMerge();
        });

        document.getElementById('merge-export-btn').addEventListener('click', () => {
            this.exportMergeAudio();
        });
    }

    /**
     * 绑定窗口事件
     */
    bindWindowEvents() {
        // 窗口大小变化时重绘波形
        window.addEventListener('resize', () => {
            if (this.cutState.audioBuffer) {
                this.drawCutWaveform();
            }
            if (this.mergeState.audio1.buffer) {
                this.drawMergeWaveform(1);
            }
            if (this.mergeState.audio2.buffer) {
                this.drawMergeWaveform(2);
            }
            if (this.mergeState.mergedBuffer) {
                this.drawMergedWaveform();
            }
        });
    }

    // ==================== 剪切功能 ====================

    /**
     * 加载剪切音频
     * @param {File} file - 音频文件
     */
    async loadCutAudio(file) {
        try {
            window.uiManager.showLoading('正在加载音频...');
            
            this.stopCutPlayback();
            
            const buffer = await window.audioEngine.loadAudioFile(file);
            this.cutState.audioBuffer = buffer;
            this.cutState.fileName = file.name;
            
            // 显示工作区
            document.getElementById('cut-workspace').style.display = 'block';
            document.getElementById('cut-upload-area').style.display = 'none';
            
            // 显示文件信息
            const info = window.audioEngine.getAudioInfo(buffer);
            document.getElementById('cut-file-info').innerHTML = `
                <strong>${file.name}</strong> | 
                时长: ${info.durationFormatted} | 
                采样率: ${info.sampleRate} Hz | 
                声道: ${info.channels} | 
                大小: ${window.uiManager.formatFileSize(file.size)}
            `;
            
            // 更新时间显示
            document.getElementById('cut-duration').textContent = info.durationFormatted;
            document.getElementById('cut-end-time').value = buffer.duration.toFixed(3);
            document.getElementById('cut-end-time').max = buffer.duration;
            document.getElementById('cut-start-time').max = buffer.duration;
            
            // 绘制波形
            this.drawCutWaveform();
            
            window.uiManager.hideLoading();
            window.uiManager.showToast('音频加载成功', 'success');
            
        } catch (error) {
            window.uiManager.hideLoading();
            window.uiManager.showToast(error.message, 'error');
        }
    }

    /**
     * 绘制剪切波形
     */
    drawCutWaveform() {
        const canvas = document.getElementById('cut-waveform');
        const startTime = parseFloat(document.getElementById('cut-start-time').value) || 0;
        const endTime = parseFloat(document.getElementById('cut-end-time').value) || this.cutState.audioBuffer.duration;
        const duration = this.cutState.audioBuffer.duration;
        
        window.waveformRenderer.drawWithSelection(
            canvas,
            this.cutState.audioBuffer,
            startTime / duration,
            endTime / duration
        );
    }

    /**
     * 更新剪切选区
     */
    updateCutSelection() {
        if (!this.cutState.audioBuffer) return;
        
        const startTime = parseFloat(document.getElementById('cut-start-time').value) || 0;
        const endTime = parseFloat(document.getElementById('cut-end-time').value) || this.cutState.audioBuffer.duration;
        const duration = this.cutState.audioBuffer.duration;
        
        // 重绘波形
        this.drawCutWaveform();
        
        // 更新选区覆盖层
        const selection = document.getElementById('cut-selection');
        window.uiManager.updateSelection(selection, startTime / duration, endTime / duration);
    }

    /**
     * 切换剪切播放
     */
    toggleCutPlayback() {
        if (this.cutState.isPlaying) {
            this.pauseCutPlayback();
        } else {
            this.playCutAudio();
        }
    }

    /**
     * 播放剪切音频
     */
    async playCutAudio() {
        if (!this.cutState.audioBuffer) return;
        
        const ctx = window.audioEngine.audioContext;
        await window.audioEngine.ensureContextRunning();
        
        this.cutState.sourceNode = ctx.createBufferSource();
        this.cutState.sourceNode.buffer = this.cutState.audioBuffer;
        this.cutState.sourceNode.connect(ctx.destination);
        
        const offset = this.cutState.pauseTime;
        this.cutState.startTime = ctx.currentTime - offset;
        this.cutState.sourceNode.start(0, offset);
        this.cutState.isPlaying = true;
        
        window.uiManager.updatePlayButton(document.getElementById('cut-play-btn'), true);
        
        this.cutState.sourceNode.onended = () => {
            if (this.cutState.isPlaying) {
                this.stopCutPlayback();
            }
        };
        
        this.updateCutPlayhead();
    }

    /**
     * 暂停剪切播放
     */
    pauseCutPlayback() {
        if (!this.cutState.isPlaying) return;
        
        const ctx = window.audioEngine.audioContext;
        this.cutState.pauseTime = ctx.currentTime - this.cutState.startTime;
        
        this.cutState.sourceNode.stop();
        this.cutState.isPlaying = false;
        
        window.uiManager.updatePlayButton(document.getElementById('cut-play-btn'), false);
        cancelAnimationFrame(this.cutState.animationFrame);
    }

    /**
     * 停止剪切播放
     */
    stopCutPlayback() {
        if (this.cutState.sourceNode) {
            try {
                this.cutState.sourceNode.stop();
            } catch (e) {}
        }
        
        this.cutState.isPlaying = false;
        this.cutState.pauseTime = 0;
        
        window.uiManager.updatePlayButton(document.getElementById('cut-play-btn'), false);
        window.uiManager.hidePlayhead(document.getElementById('cut-playhead'));
        window.uiManager.updateTimeDisplay(document.getElementById('cut-current-time'), 0);
        
        cancelAnimationFrame(this.cutState.animationFrame);
    }

    /**
     * 更新剪切播放头
     */
    updateCutPlayhead() {
        if (!this.cutState.isPlaying) return;
        
        const ctx = window.audioEngine.audioContext;
        const currentTime = ctx.currentTime - this.cutState.startTime;
        const duration = this.cutState.audioBuffer.duration;
        
        if (currentTime >= duration) {
            this.stopCutPlayback();
            return;
        }
        
        const percent = currentTime / duration;
        window.uiManager.updatePlayhead(document.getElementById('cut-playhead'), percent);
        window.uiManager.updateTimeDisplay(document.getElementById('cut-current-time'), currentTime);
        
        this.cutState.animationFrame = requestAnimationFrame(() => this.updateCutPlayhead());
    }

    /**
     * 预览剪切选区
     */
    async previewCutSelection() {
        if (!this.cutState.audioBuffer) {
            window.uiManager.showToast('请先上传音频文件', 'error');
            return;
        }
        
        this.stopCutPlayback();
        
        const startTime = parseFloat(document.getElementById('cut-start-time').value) || 0;
        const endTime = parseFloat(document.getElementById('cut-end-time').value) || this.cutState.audioBuffer.duration;
        
        if (startTime >= endTime) {
            window.uiManager.showToast('开始时间必须小于结束时间', 'error');
            return;
        }
        
        if (endTime > this.cutState.audioBuffer.duration) {
            window.uiManager.showToast('结束时间超出音频长度', 'error');
            return;
        }
        
        try {
            const ctx = window.audioEngine.audioContext;
            await window.audioEngine.ensureContextRunning();
            
            this.cutState.sourceNode = ctx.createBufferSource();
            this.cutState.sourceNode.buffer = this.cutState.audioBuffer;
            this.cutState.sourceNode.connect(ctx.destination);
            
            const duration = endTime - startTime;
            const playStartTime = ctx.currentTime;
            this.cutState.sourceNode.start(0, startTime, duration);
            this.cutState.isPlaying = true;
            
            window.uiManager.updatePlayButton(document.getElementById('cut-play-btn'), true);
            window.uiManager.showToast(`正在播放选区 ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`, 'info');
            
            this.cutState.sourceNode.onended = () => {
                this.stopCutPlayback();
            };
            
            // 更新播放头（限制在选区内）
            const updatePreviewPlayhead = () => {
                if (!this.cutState.isPlaying) return;
                
                const elapsed = ctx.currentTime - playStartTime;
                const currentTime = startTime + elapsed;
                
                if (currentTime >= endTime || elapsed >= duration) {
                    this.stopCutPlayback();
                    return;
                }
                
                const percent = currentTime / this.cutState.audioBuffer.duration;
                window.uiManager.updatePlayhead(document.getElementById('cut-playhead'), percent);
                window.uiManager.updateTimeDisplay(document.getElementById('cut-current-time'), currentTime);
                
                this.cutState.animationFrame = requestAnimationFrame(updatePreviewPlayhead);
            };
            
            updatePreviewPlayhead();
            
        } catch (error) {
            console.error('预览选区失败:', error);
            window.uiManager.showToast('预览失败: ' + error.message, 'error');
        }
    }

    /**
     * 导出剪切音频
     */
    async exportCutAudio() {
        if (!this.cutState.audioBuffer) return;
        
        const startTime = parseFloat(document.getElementById('cut-start-time').value) || 0;
        const endTime = parseFloat(document.getElementById('cut-end-time').value) || this.cutState.audioBuffer.duration;
        
        if (startTime >= endTime) {
            window.uiManager.showToast('开始时间必须小于结束时间', 'error');
            return;
        }
        
        try {
            window.uiManager.showLoading('正在处理音频...');
            
            // 剪切音频
            const cutBuffer = window.audioEngine.cutAudio(this.cutState.audioBuffer, startTime, endTime);
            
            // 导出
            const format = document.getElementById('cut-format').value;
            const baseName = this.cutState.fileName.replace(/\.[^/.]+$/, '');
            const filename = `${baseName}_cut_${startTime.toFixed(1)}s-${endTime.toFixed(1)}s`;
            
            await window.audioExporter.export(cutBuffer, format, filename, (progress) => {
                window.uiManager.showLoading(`正在编码... ${Math.round(progress * 100)}%`);
            });
            
            window.uiManager.hideLoading();
            window.uiManager.showToast('导出成功', 'success');
            
        } catch (error) {
            window.uiManager.hideLoading();
            window.uiManager.showToast(error.message, 'error');
        }
    }

    // ==================== 合并功能 ====================

    /**
     * 加载合并音频
     * @param {number} trackNum - 轨道编号 (1 或 2)
     * @param {File} file - 音频文件
     */
    async loadMergeAudio(trackNum, file) {
        try {
            window.uiManager.showLoading('正在加载音频...');
            
            const buffer = await window.audioEngine.loadAudioFile(file);
            const audioKey = `audio${trackNum}`;
            
            this.mergeState[audioKey].buffer = buffer;
            this.mergeState[audioKey].fileName = file.name;
            
            // 隐藏上传区域，显示信息
            document.getElementById(`merge-upload-${trackNum}`).style.display = 'none';
            document.getElementById(`merge-info-${trackNum}`).style.display = 'block';
            
            // 显示文件信息
            const info = window.audioEngine.getAudioInfo(buffer);
            document.getElementById(`merge-name-${trackNum}`).textContent = file.name;
            document.getElementById(`merge-duration-${trackNum}`).textContent = info.durationFormatted;
            
            // 绘制波形
            this.drawMergeWaveform(trackNum);
            
            // 更新按钮状态
            this.updateMergeButtons();
            
            // 清除之前的合并结果
            this.mergeState.mergedBuffer = null;
            document.getElementById('merge-preview').style.display = 'none';
            
            window.uiManager.hideLoading();
            window.uiManager.showToast('音频加载成功', 'success');
            
        } catch (error) {
            window.uiManager.hideLoading();
            window.uiManager.showToast(error.message, 'error');
        }
    }

    /**
     * 移除合并音频
     * @param {number} trackNum - 轨道编号
     */
    removeMergeAudio(trackNum) {
        const audioKey = `audio${trackNum}`;
        
        this.mergeState[audioKey].buffer = null;
        this.mergeState[audioKey].fileName = '';
        
        // 显示上传区域，隐藏信息
        document.getElementById(`merge-upload-${trackNum}`).style.display = 'block';
        document.getElementById(`merge-info-${trackNum}`).style.display = 'none';
        
        // 清除文件输入
        document.getElementById(`merge-file-${trackNum}`).value = '';
        
        // 更新按钮状态
        this.updateMergeButtons();
        
        // 清除合并结果
        this.mergeState.mergedBuffer = null;
        document.getElementById('merge-preview').style.display = 'none';
    }

    /**
     * 绘制合并轨道波形
     * @param {number} trackNum - 轨道编号
     */
    drawMergeWaveform(trackNum) {
        const canvas = document.getElementById(`merge-waveform-${trackNum}`);
        const buffer = this.mergeState[`audio${trackNum}`].buffer;
        
        if (buffer) {
            window.waveformRenderer.draw(canvas, buffer);
        }
    }

    /**
     * 绘制合并结果波形
     */
    drawMergedWaveform() {
        const canvas = document.getElementById('merge-result-waveform');
        
        if (this.mergeState.mergedBuffer) {
            window.waveformRenderer.draw(canvas, this.mergeState.mergedBuffer);
        }
    }

    /**
     * 更新合并按钮状态
     */
    updateMergeButtons() {
        const hasAudio1 = this.mergeState.audio1.buffer !== null;
        const hasAudio2 = this.mergeState.audio2.buffer !== null;
        const canMerge = hasAudio1 && hasAudio2;
        
        document.getElementById('merge-preview-btn').disabled = !canMerge;
        document.getElementById('merge-export-btn').disabled = !canMerge;
    }

    /**
     * 预览合并效果
     */
    async previewMerge() {
        if (!this.mergeState.audio1.buffer || !this.mergeState.audio2.buffer) {
            window.uiManager.showToast('请先上传两个音频文件', 'error');
            return;
        }
        
        try {
            window.uiManager.showLoading('正在合并音频...');
            
            this.stopMergePlayback();
            
            const mode = document.querySelector('input[name="merge-mode"]:checked').value;
            
            if (mode === 'concat') {
                this.mergeState.mergedBuffer = window.audioEngine.concatAudio(
                    this.mergeState.audio1.buffer,
                    this.mergeState.audio2.buffer
                );
            } else {
                this.mergeState.mergedBuffer = window.audioEngine.mixAudio(
                    this.mergeState.audio1.buffer,
                    this.mergeState.audio2.buffer
                );
            }
            
            // 显示预览区域
            document.getElementById('merge-preview').style.display = 'block';
            
            // 更新时长显示
            const info = window.audioEngine.getAudioInfo(this.mergeState.mergedBuffer);
            document.getElementById('merge-duration').textContent = info.durationFormatted;
            
            // 绘制波形
            this.drawMergedWaveform();
            
            window.uiManager.hideLoading();
            window.uiManager.showToast('合并完成，可以预览播放', 'success');
            
        } catch (error) {
            window.uiManager.hideLoading();
            window.uiManager.showToast(error.message, 'error');
        }
    }

    /**
     * 切换合并播放
     */
    toggleMergePlayback() {
        if (this.mergeState.isPlaying) {
            this.pauseMergePlayback();
        } else {
            this.playMergeAudio();
        }
    }

    /**
     * 播放合并音频
     */
    async playMergeAudio() {
        if (!this.mergeState.mergedBuffer) return;
        
        const ctx = window.audioEngine.audioContext;
        await window.audioEngine.ensureContextRunning();
        
        this.mergeState.sourceNode = ctx.createBufferSource();
        this.mergeState.sourceNode.buffer = this.mergeState.mergedBuffer;
        this.mergeState.sourceNode.connect(ctx.destination);
        
        const offset = this.mergeState.pauseTime;
        this.mergeState.startTime = ctx.currentTime - offset;
        this.mergeState.sourceNode.start(0, offset);
        this.mergeState.isPlaying = true;
        
        window.uiManager.updatePlayButton(document.getElementById('merge-play-btn'), true);
        
        this.mergeState.sourceNode.onended = () => {
            if (this.mergeState.isPlaying) {
                this.stopMergePlayback();
            }
        };
        
        this.updateMergePlayhead();
    }

    /**
     * 暂停合并播放
     */
    pauseMergePlayback() {
        if (!this.mergeState.isPlaying) return;
        
        const ctx = window.audioEngine.audioContext;
        this.mergeState.pauseTime = ctx.currentTime - this.mergeState.startTime;
        
        this.mergeState.sourceNode.stop();
        this.mergeState.isPlaying = false;
        
        window.uiManager.updatePlayButton(document.getElementById('merge-play-btn'), false);
        cancelAnimationFrame(this.mergeState.animationFrame);
    }

    /**
     * 停止合并播放
     */
    stopMergePlayback() {
        if (this.mergeState.sourceNode) {
            try {
                this.mergeState.sourceNode.stop();
            } catch (e) {}
        }
        
        this.mergeState.isPlaying = false;
        this.mergeState.pauseTime = 0;
        
        window.uiManager.updatePlayButton(document.getElementById('merge-play-btn'), false);
        window.uiManager.updateTimeDisplay(document.getElementById('merge-current-time'), 0);
        
        cancelAnimationFrame(this.mergeState.animationFrame);
    }

    /**
     * 更新合并播放头
     */
    updateMergePlayhead() {
        if (!this.mergeState.isPlaying) return;
        
        const ctx = window.audioEngine.audioContext;
        const currentTime = ctx.currentTime - this.mergeState.startTime;
        const duration = this.mergeState.mergedBuffer.duration;
        
        if (currentTime >= duration) {
            this.stopMergePlayback();
            return;
        }
        
        window.uiManager.updateTimeDisplay(document.getElementById('merge-current-time'), currentTime);
        
        this.mergeState.animationFrame = requestAnimationFrame(() => this.updateMergePlayhead());
    }

    /**
     * 导出合并音频
     */
    async exportMergeAudio() {
        if (!this.mergeState.mergedBuffer) {
            // 先执行合并
            await this.previewMerge();
            if (!this.mergeState.mergedBuffer) return;
        }
        
        try {
            window.uiManager.showLoading('正在导出音频...');
            
            const format = document.getElementById('merge-format').value;
            const mode = document.querySelector('input[name="merge-mode"]:checked').value;
            const filename = `merged_${mode}_${Date.now()}`;
            
            await window.audioExporter.export(this.mergeState.mergedBuffer, format, filename, (progress) => {
                window.uiManager.showLoading(`正在编码... ${Math.round(progress * 100)}%`);
            });
            
            window.uiManager.hideLoading();
            window.uiManager.showToast('导出成功', 'success');
            
        } catch (error) {
            window.uiManager.hideLoading();
            window.uiManager.showToast(error.message, 'error');
        }
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    const app = new AudioEditorApp();
    app.init();
});
