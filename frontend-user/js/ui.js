/**
 * UIManager - UI 交互管理模块
 * 负责处理用户界面交互和状态管理
 */
class UIManager {
    constructor() {
        this.toastContainer = null;
    }

    /**
     * 初始化 UI 管理器
     */
    init() {
        this.toastContainer = document.getElementById('toast-container');
        this.initCustomSelects();
    }

    /**
     * 初始化自定义下拉框
     */
    initCustomSelects() {
        const customSelects = document.querySelectorAll('.custom-select');
        
        customSelects.forEach(select => {
            const trigger = select.querySelector('.custom-select-trigger');
            const options = select.querySelectorAll('.custom-select-option');
            const hiddenInput = select.parentElement.querySelector('input[type="hidden"]');
            
            // 点击触发器
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // 关闭其他下拉框
                customSelects.forEach(s => {
                    if (s !== select) s.classList.remove('active');
                });
                // 切换当前下拉框
                select.classList.toggle('active');
            });
            
            // 选择选项
            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = option.dataset.value;
                    const text = option.textContent;
                    
                    // 更新显示文本
                    trigger.querySelector('span').textContent = text;
                    
                    // 更新隐藏输入框的值
                    if (hiddenInput) {
                        hiddenInput.value = value;
                    }
                    
                    // 更新选中状态
                    options.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    
                    // 关闭下拉框
                    select.classList.remove('active');
                });
            });
        });
        
        // 点击外部关闭所有下拉框
        document.addEventListener('click', () => {
            customSelects.forEach(select => {
                select.classList.remove('active');
            });
        });
    }

    /**
     * 显示加载遮罩
     * @param {string} text - 加载提示文字
     */
    showLoading(text = '处理中...') {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loading-text');
        loadingText.textContent = text;
        loading.style.display = 'flex';
    }

    /**
     * 隐藏加载遮罩
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
    }

    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 ('success', 'error', 'info')
     * @param {number} duration - 显示时长（毫秒）
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    /**
     * 更新播放按钮状态
     * @param {HTMLElement} button - 按钮元素
     * @param {boolean} isPlaying - 是否正在播放
     */
    updatePlayButton(button, isPlaying) {
        button.textContent = isPlaying ? '⏸' : '▶';
        button.title = isPlaying ? '暂停' : '播放';
    }

    /**
     * 更新时间显示
     * @param {HTMLElement} element - 时间显示元素
     * @param {number} seconds - 秒数
     */
    updateTimeDisplay(element, seconds) {
        element.textContent = window.audioEngine.formatTime(seconds);
    }

    /**
     * 更新播放头位置
     * @param {HTMLElement} playhead - 播放头元素
     * @param {number} percent - 位置百分比 (0-1)
     */
    updatePlayhead(playhead, percent) {
        playhead.style.left = `${percent * 100}%`;
        playhead.style.display = 'block';
    }

    /**
     * 隐藏播放头
     * @param {HTMLElement} playhead - 播放头元素
     */
    hidePlayhead(playhead) {
        playhead.style.display = 'none';
    }

    /**
     * 更新选区显示
     * @param {HTMLElement} selection - 选区元素
     * @param {number} startPercent - 开始位置百分比
     * @param {number} endPercent - 结束位置百分比
     */
    updateSelection(selection, startPercent, endPercent) {
        selection.style.left = `${startPercent * 100}%`;
        selection.style.width = `${(endPercent - startPercent) * 100}%`;
        selection.style.display = 'block';
    }

    /**
     * 隐藏选区
     * @param {HTMLElement} selection - 选区元素
     */
    hideSelection(selection) {
        selection.style.display = 'none';
    }

    /**
     * 设置拖拽区域事件
     * @param {HTMLElement} element - 拖拽区域元素
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {Function} onFile - 文件选择回调
     */
    setupDropZone(element, input, onFile) {
        // 点击上传
        element.addEventListener('click', () => {
            input.click();
        });

        // 文件选择
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                onFile(file);
            }
        });

        // 拖拽事件
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('dragover');
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('dragover');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                onFile(file);
            } else {
                this.showToast('请拖入音频文件', 'error');
            }
        });
    }

    /**
     * 设置波形点击事件
     * @param {HTMLCanvasElement} canvas - 波形画布
     * @param {Function} onClick - 点击回调
     */
    setupWaveformClick(canvas, onClick) {
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            onClick(percent);
        });
    }

    /**
     * 设置波形拖拽选择事件
     * @param {HTMLCanvasElement} canvas - 波形画布
     * @param {Function} onSelect - 选择回调 (startPercent, endPercent)
     */
    setupWaveformDrag(canvas, onSelect) {
        let isDragging = false;
        let startX = 0;

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = canvas.getBoundingClientRect();
            startX = (e.clientX - rect.left) / rect.width;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const currentX = (e.clientX - rect.left) / rect.width;
            
            const start = Math.min(startX, currentX);
            const end = Math.max(startX, currentX);
            
            onSelect(Math.max(0, start), Math.min(1, end));
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
        });
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string}
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// 创建全局实例
window.uiManager = new UIManager();
