class YouTubePlaylistGenerator {
    constructor() {
        this.isProcessing = false;
        this.processingStartTime = null;
        this.cancelRequested = false;
        this.currentStats = {
            total: 0,
            valid: 0,
            invalid: 0
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTheme();
        this.updateChunkWarning();
    }

    bindEvents() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => this.toggleTheme());

        // Chunk size warning
        const chunkSize = document.getElementById('chunkSize');
        chunkSize.addEventListener('change', () => this.updateChunkWarning());

        // Generate button
        const generateBtn = document.getElementById('generateBtn');
        generateBtn.addEventListener('click', () => this.startGeneration());

        // Cancel button
        const cancelBtn = document.getElementById('cancelBtn');
        cancelBtn.addEventListener('click', () => this.cancelGeneration());

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => this.exportToCSV());
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-color-scheme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-color-scheme', theme);
        const themeIcon = document.querySelector('.theme-icon');
        const themeText = document.querySelector('.theme-text');
        
        if (theme === 'dark') {
            themeIcon.textContent = '☀️';
            themeText.textContent = 'ライトモード';
        } else {
            themeIcon.textContent = '🌙';
            themeText.textContent = 'ダークモード';
        }
    }

    updateChunkWarning() {
        const chunkSize = document.getElementById('chunkSize').value;
        const warning = document.getElementById('unlimitedWarning');
        
        if (chunkSize === 'unlimited') {
            warning.classList.remove('hidden');
            warning.style.display = 'block';
        } else {
            warning.classList.add('hidden');
            warning.style.display = 'none';
        }
    }

    async startGeneration() {
        if (this.isProcessing) return;

        const urlInput = document.getElementById('urlInput').value.trim();
        if (!urlInput) {
            alert('YouTube URLを入力してください。');
            return;
        }

        this.isProcessing = true;
        this.cancelRequested = false;
        this.processingStartTime = Date.now();

        this.showProcessingUI();
        this.updateGenerateButton(true);

        try {
            const urls = this.parseUrls(urlInput);
            const chunkSize = this.getChunkSize();
            
            await this.processUrls(urls, chunkSize);
            
            if (!this.cancelRequested) {
                this.showResults();
            }
        } catch (error) {
            console.error('Generation error:', error);
            alert('処理中にエラーが発生しました。');
        } finally {
            this.isProcessing = false;
            this.updateGenerateButton(false);
        }
    }

    cancelGeneration() {
        this.cancelRequested = true;
        this.isProcessing = false;
        this.updateGenerateButton(false);
        this.hideProcessingUI();
        
        // Reset progress
        this.updateProgress(0, 'キャンセルされました');
    }

    parseUrls(input) {
        const lines = input.split('\n').map(line => line.trim()).filter(line => line);
        const urls = [];
        
        for (const line of lines) {
            const videoId = this.extractVideoId(line);
            if (videoId) {
                urls.push({
                    original: line,
                    videoId: videoId,
                    valid: true
                });
            } else {
                urls.push({
                    original: line,
                    videoId: null,
                    valid: false
                });
            }
        }
        
        return urls;
    }

    extractVideoId(url) {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
            /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/,
            /^([a-zA-Z0-9_-]{11})$/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    }

    getChunkSize() {
        const value = document.getElementById('chunkSize').value;
        return value === 'unlimited' ? Infinity : parseInt(value, 10);
    }

    async processUrls(urls, chunkSize) {
        // Initialize stats
        this.currentStats = {
            total: urls.length,
            valid: urls.filter(url => url.valid).length,
            invalid: urls.filter(url => !url.valid).length
        };

        this.updateStats();
        this.updateProgress(10, 'URLを解析中...');

        const validUrls = urls.filter(url => url.valid);
        
        if (validUrls.length === 0) {
            this.updateProgress(100, '有効なURLが見つかりませんでした');
            return;
        }

        this.updateProgress(25, 'チャンクを作成中...');
        await this.delay(200);

        const chunks = this.chunkArray(validUrls, chunkSize);
        const playlistUrls = [];

        this.updateProgress(35, `${chunks.length}個のチャンクを処理開始...`);
        await this.delay(300);

        for (let i = 0; i < chunks.length; i++) {
            if (this.cancelRequested) break;

            const chunk = chunks[i];
            const chunkProgress = 35 + ((i / chunks.length) * 60); // 35% to 95%
            
            this.updateProgress(chunkProgress, `チャンク ${i + 1}/${chunks.length} を処理中...`);
            
            const playlistUrl = this.generatePlaylistUrl(chunk);
            playlistUrls.push({
                url: playlistUrl,
                count: chunk.length,
                chunk: i + 1,
                total: chunks.length
            });

            // Non-blocking delay for UI updates
            await this.delay(Math.min(500, 2000 / chunks.length));
        }

        if (!this.cancelRequested) {
            this.updateProgress(95, '結果を準備中...');
            await this.delay(300);
            
            this.updateProgress(100, '処理完了！');
            this.playlistUrls = playlistUrls;
        }
    }

    chunkArray(array, size) {
        if (size === Infinity) return [array];
        
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    generatePlaylistUrl(videoList) {
        const videoIds = videoList.map(video => video.videoId);
        const playlistParam = videoIds.join(',');
        return `https://www.youtube.com/watch_videos?video_ids=${playlistParam}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showProcessingUI() {
        const progressSection = document.getElementById('progressSection');
        const resultsSection = document.getElementById('resultsSection');
        const cancelBtn = document.getElementById('cancelBtn');
        
        progressSection.classList.remove('hidden');
        progressSection.style.display = 'block';
        resultsSection.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        
        // Reset progress
        this.updateProgress(0, '処理を開始しています...');
    }

    hideProcessingUI() {
        const cancelBtn = document.getElementById('cancelBtn');
        cancelBtn.classList.add('hidden');
    }

    updateGenerateButton(processing) {
        const btn = document.getElementById('generateBtn');
        const btnText = btn.querySelector('.btn-text');
        const btnIcon = btn.querySelector('.btn-icon');
        
        if (processing) {
            btn.classList.add('processing');
            btn.disabled = false; // Keep it clickable-looking but handle in click handler
            btnText.textContent = '処理中';
            btnIcon.textContent = '⚡';
        } else {
            btn.classList.remove('processing');
            btn.disabled = false;
            btnText.textContent = '生成開始';
            btnIcon.textContent = '🚀';
        }
    }

    updateProgress(percent, status) {
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (progressPercent) progressPercent.textContent = `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
        if (progressStatus) progressStatus.textContent = status;
        
        this.updateProcessingTime();
    }

    updateStats() {
        const totalUrls = document.getElementById('totalUrls');
        const validUrls = document.getElementById('validUrls');
        const invalidUrls = document.getElementById('invalidUrls');
        
        if (totalUrls) totalUrls.textContent = this.currentStats.total;
        if (validUrls) validUrls.textContent = this.currentStats.valid;
        if (invalidUrls) invalidUrls.textContent = this.currentStats.invalid;
    }

    updateProcessingTime() {
        const processingTime = document.getElementById('processingTime');
        if (this.processingStartTime && processingTime) {
            const elapsed = Math.round((Date.now() - this.processingStartTime) / 1000);
            processingTime.textContent = `${elapsed}秒`;
        }
    }

    showResults() {
        const resultsSection = document.getElementById('resultsSection');
        const playlistLinks = document.getElementById('playlistLinks');
        
        if (!resultsSection || !playlistLinks) return;
        
        playlistLinks.innerHTML = '';
        
        if (!this.playlistUrls || this.playlistUrls.length === 0) {
            playlistLinks.innerHTML = '<div class="status status--warning">生成されたプレイリストがありません</div>';
        } else {
            this.playlistUrls.forEach((playlist, index) => {
                const link = document.createElement('a');
                link.href = playlist.url;
                link.target = '_blank';
                link.className = 'playlist-link';
                
                if (playlist.total > 1) {
                    link.textContent = `プレイリスト ${playlist.chunk}/${playlist.total} (${playlist.count}件の動画)`;
                } else {
                    link.textContent = `プレイリスト (${playlist.count}件の動画)`;
                }
                
                playlistLinks.appendChild(link);
            });
        }
        
        resultsSection.classList.remove('hidden');
        resultsSection.style.display = 'block';
        resultsSection.classList.add('fade-in');
        
        // Smooth scroll to results
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    exportToCSV() {
        if (!this.playlistUrls || this.playlistUrls.length === 0) {
            alert('エクスポートするデータがありません。');
            return;
        }

        const csvContent = this.generateCSVContent();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `youtube_playlists_${new Date().getTime()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }

    generateCSVContent() {
        const headers = ['チャンク番号', '動画数', 'プレイリストURL'];
        const rows = this.playlistUrls.map(playlist => [
            playlist.chunk,
            playlist.count,
            playlist.url
        ]);

        const csvRows = [headers, ...rows];
        return csvRows.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new YouTubePlaylistGenerator();
});

// Additional utility functions for enhanced UX
function addRippleEffect(button) {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;
        
        ripple.classList.add('ripple');
        
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.remove();
            }
        }, 600);
    });
}

// Add CSS for ripple animation
const rippleCSS = `
@keyframes ripple {
    to {
        transform: scale(4);
        opacity: 0;
    }
}
`;

// Inject ripple CSS
const style = document.createElement('style');
style.textContent = rippleCSS;
document.head.appendChild(style);

// Add ripple effects to buttons
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(addRippleEffect);
});

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('urlInput');
    if (textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 400) + 'px';
        });
    }
});