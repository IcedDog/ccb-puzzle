// 游戏状态
let gameState = {
    isGameActive: false,
    characterBank: new Set(),
    lastAddedChars: new Set(),
    targetWord: '',
    disableEnglish: true,
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '',
    modelName: 'deepseek-ai/DeepSeek-V3',
    modelTemperature: 0.7,
    initPrompt: '请回应方括号中的内容，不超过20字。如果是名词，给出简要解释。如果是提问，直接给出回答，但注意不要超过20字。如果是命令，可以执行，但不得超过20字。',
    chatHistory: [],
    startTime: null,
    theme: 'light',
    initBank: ''
};

window.urlParamsLoaded = false;

// 初始化
function init() {
    loadSettings();
    updateCharacterGrid();
    setupInputValidation();
    if (!window.urlParamsLoaded) detectUrlParams();

    if (window.isChallenge) {
        fetch('https://gist.githubusercontent.com/IcedDog/3daa85b4aba423386504b7ad072b59d6/raw/9595f1d07a0df1ee78d0e770409c7dff4404d6a9/daily-challenge.json')
            .then(response => response.json())
            .then(data => {
                date = data.date;
                document.getElementById('initialChars').value = data.bank;
                document.getElementById('targetWord').value = data.goal;
            }).catch(error => {
                showToast('无法获取每日挑战：' + error, '#e74c3c');
            });
    }
}

function detectUrlParams() {
    window.urlParamsLoaded = true;
    const urlParams = new URLSearchParams(window.location.search);
    const target = urlParams.get('target');
    const bank = urlParams.get('bank');
    document.getElementById('initialChars').value = bank ? bank : '';
    document.getElementById('targetWord').value = target ? target : '';
    if (bank !== null && targetWord !== null && gameState.apiKey !== '') {
        startGame();
    }
}

function isChinese(char) {
    const chineseRegex = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\U00020000-U0002EBEF]/;
    const numberRegex = /[\d\uFF10-\uFF19\u00BC-\u00BE\u2150-\u215E\u00B2-\u00B3\u2070-\u2079\u00B9\u00B0\u00A3\u20A0-\u20CF\w]/;
    return chineseRegex.test(char) && !numberRegex.test(char);
}

function isPunctuation(char) {
    const punctuationRegex = /[ \u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\uFF00-\uFFEF!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~。、！？：；“”‘’（）《》【】｛｝～—…·]/;
    return punctuationRegex.test(char);
}

// 设置输入验证
function setupInputValidation() {
    const input = document.getElementById('userInput');
    const warning = document.getElementById('inputWarning');
    const submitBtn = document.getElementById('submitBtn');

    input.addEventListener('input', function () {
        if (!gameState.isGameActive) return;

        const text = this.value;
        const isValid = validateInput(text);

        if (text && isValid !== "") {
            this.classList.add('invalid');
            warning.classList.add('show');
            warning.textContent = `包含非法字符，无法发送：${isValid}`;
            submitBtn.disabled = true;
        } else {
            this.classList.remove('invalid');
            warning.classList.remove('show');
            submitBtn.disabled = false;
        }
    });
}

// 开始游戏
function startGame() {
    const initialChars = document.getElementById('initialChars').value.trim();
    const targetWord = document.getElementById('targetWord').value.trim();

    if (!initialChars || !targetWord) {
        showToast('请输入初始字库和目标词', "#e74c3c");
        return;
    }

    if (!gameState.apiKey) {
        showToast('请先在设置中配置API密钥', "#e74c3c");
        openSettings();
        return;
    }

    // 初始化游戏状态
    gameState.isGameActive = true;
    gameState.targetWord = targetWord;
    gameState.characterBank = new Set();
    gameState.lastAddedChars = new Set();
    gameState.startTime = new Date();
    gameState.initBank = '';

    // 添加初始字符到字库
    for (let char of initialChars) {
        if (gameState.disableEnglish && !isChinese(char) && !isPunctuation(char)) {
            continue;
        }
        if (!isPunctuation(char)) {
            gameState.characterBank.add(char);
            gameState.initBank += char;
        }
    }

    // 更新界面
    document.getElementById('gameSetup').style.display = 'none';
    document.getElementById('gameArea').classList.add('active');
    document.getElementById('currentTarget').textContent = targetWord;
    updateCharacterGrid();
    clearInput();
    clearChatHistory();

    // 重置输入验证状态
    const input = document.getElementById('userInput');
    const warning = document.getElementById('inputWarning');
    const submitBtn = document.getElementById('submitBtn');
    input.classList.remove('invalid');
    warning.classList.remove('show');
    submitBtn.disabled = false;
}

// 更新字符网格
function updateCharacterGrid() {
    const grid = document.getElementById('characterGrid');
    const charCount = document.getElementById('charCount');

    grid.innerHTML = '';
    charCount.textContent = gameState.characterBank.size;

    const sortedChars = Array.from(gameState.characterBank).sort();
    sortedChars.forEach(char => {
        const btn = document.createElement('button');
        btn.className = 'char-btn';
        btn.textContent = char;
        btn.onclick = () => addCharToInput(char);
        grid.appendChild(btn);
    });
}

// 添加字符到输入框
function addCharToInput(char) {
    const input = document.getElementById('userInput');
    input.value += char;
}

// 清空输入
function clearInput() {
    document.getElementById('userInput').value = '';
}

// 添加聊天记录
function addChatMessage(content, isUser = false) {
    const chatContainer = document.getElementById('chatContainer');
    const placeholder = chatContainer.querySelector('.chat-placeholder');

    // 移除占位符
    if (placeholder) {
        placeholder.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'message-user' : 'message-ai'}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = content;

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();

    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timeDiv);
    chatContainer.appendChild(messageDiv);

    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 添加到历史记录
    gameState.chatHistory.push({
        content: content,
        isUser: isUser,
        timestamp: new Date().toISOString()
    });

    document.getElementById("chatCount").textContent = gameState.chatHistory.length / 2 - gameState.chatHistory.length / 2 % 1
}

// 清空聊天记录
function clearChatHistory() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '<div class="chat-placeholder">开始提问来查看聊天记录...</div>';
    gameState.chatHistory = [];
}

// 显示加载消息
function showLoadingMessage() {
    const chatContainer = document.getElementById('chatContainer');
    const placeholder = chatContainer.querySelector('.chat-placeholder');

    if (placeholder) {
        placeholder.remove();
    }

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message message-ai';
    loadingDiv.id = 'loadingMessage';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.innerHTML = '<em>AI正在思考中...</em>';

    loadingDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(loadingDiv);

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 移除加载消息
function removeLoadingMessage() {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

// 验证输入
function validateInput(text) {
    let ret = new Set();
    for (let char of text) {
        if (!gameState.characterBank.has(char) && !isPunctuation(char)) {
            ret.add(char);
        }
    }
    return ret.size > 0 ? [...ret] : ""
}

// 提交问题
async function submitQuestion() {
    const input = document.getElementById('userInput');
    const question = input.value.trim();

    if (!question) {
        showToast('请输入问题', "#e74c3c");
        return;
    }

    if (validateInput(question) !== "") {
        showToast('输入包含字库中没有的字符', "#e74c3c");
        return;
    }

    // 添加用户消息到聊天记录
    addChatMessage(question, true);

    // 禁用提交按钮
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    // 显示加载消息
    showLoadingMessage();

    try {
        const response = await callAI(question);

        // 移除加载消息并添加AI回复
        removeLoadingMessage();
        addChatMessage(response, false);

        // 将回复中的字符添加到字库
        addResponseToBank(response);
        updateCharacterGrid();

        // 检查是否达成目标
        if (checkWinCondition(response)) {
            showSuccess();
            showSuccessModal();
        }

        // 清空输入
        clearInput();
    } catch (error) {
        removeLoadingMessage();
        showToast('请求失败：' + error.message, "#e74c3c");
    } finally {
        // 恢复提交按钮
        submitBtn.disabled = false;
        submitBtn.textContent = '提交';
    }
}

// 调用AI API
async function callAI(question) {
    const response = await fetch(gameState.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gameState.apiKey}`
        },
        body: JSON.stringify({
            model: gameState.modelName,
            messages: [
                {
                    role: 'user',
                    content: `${gameState.initPrompt}\n[${question}]`
                }
            ],
            max_tokens: 100,
            temperature: gameState.modelTemperature
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// 将回复添加到字库
function addResponseToBank(response) {
    gameState.lastAddedChars = new Set();
    for (let char of response) {
        if (gameState.disableEnglish && !isChinese(char) && !isPunctuation(char)) {
            continue;
        }
        if (!isPunctuation(char)) {
            if (!gameState.characterBank.has(char)) gameState.lastAddedChars.add(char);
            gameState.characterBank.add(char);
        }
    }
}

// 检查胜利条件
function checkWinCondition(response) {
    return response.includes(gameState.targetWord);
}

// 显示成功消息
function showSuccess() {
    const gameArea = document.getElementById('gameArea');
    // try delete success message if it exists
    const tryFindSuccessMsg = gameArea.querySelector('.success-message');
    if (tryFindSuccessMsg) {
        tryFindSuccessMsg.remove();
    }
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.innerHTML = `🎉 恭喜！成功挑战完成！<br>AI 回复中包含了目标词"${gameState.targetWord}"`;
    gameArea.insertBefore(successMsg, gameArea.firstChild);

    spawnConfetti(3000);

    // 禁用提交按钮
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').textContent = '挑战已完成';
}

// 重置游戏
function resetGame() {
    gameState.isGameActive = false;
    gameState.characterBank = new Set();
    gameState.lastAddedChars = new Set();
    gameState.targetWord = '';
    gameState.chatHistory = [];

    closeSuccessModal();
    document.getElementById("chatCount").textContent = 0;

    document.getElementById('gameSetup').style.display = 'block';
    document.getElementById('gameArea').classList.remove('active');

    // 移除成功消息
    const successMsg = document.querySelector('.success-message');
    if (successMsg) {
        successMsg.remove();
    }

    // 重置输入状态
    const input = document.getElementById('userInput');
    const warning = document.getElementById('inputWarning');
    const submitBtn = document.getElementById('submitBtn');
    input.classList.remove('invalid');
    warning.classList.remove('show');
    submitBtn.disabled = false;
    submitBtn.textContent = '提交';
}

// 打开设置
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
}

// 关闭设置
function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

// 保存设置
function saveSettings() {
    gameState.disableEnglish = document.getElementById('disableEnglish').checked;
    gameState.apiUrl = document.getElementById('apiUrl').value.trim();
    gameState.apiKey = document.getElementById('apiKey').value.trim();
    gameState.modelName = document.getElementById('modelName').value.trim();
    gameState.initPrompt = document.getElementById('initPrompt').value.trim();
    gameState.modelTemperature = parseFloat(document.getElementById('modelTemperature').value);

    // 保存到localStorage
    localStorage.setItem('gameSettings', JSON.stringify({
        disableEnglish: gameState.disableEnglish,
        apiUrl: gameState.apiUrl,
        apiKey: gameState.apiKey,
        modelName: gameState.modelName,
        modelTemperature: gameState.modelTemperature,
        initPrompt: gameState.initPrompt
    }));

    closeSettings();
    showToast('设置已保存', '#2ecc71');
}

// 加载设置
function loadSettings() {
    const saved = localStorage.getItem('gameSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        gameState.disableEnglish = settings.disableEnglish ?? true;
        gameState.apiUrl = settings.apiUrl || 'https://api.siliconflow.cn/v1/chat/completions';
        gameState.apiKey = settings.apiKey || '';
        gameState.modelName = settings.modelName || 'deepseek-ai/DeepSeek-V3';
        gameState.modelTemperature = settings.modelTemperature || 0.7;
        gameState.initPrompt = settings.initPrompt || '请回应方括号中的内容，不超过20字。如果是名词，给出简要解释。如果是提问，直接给出回答，但注意不要超过20字。如果是命令，可以执行，但不得超过20字。';

        if (window.isChallenge) {
            gameState.disableEnglish = true;
            gameState.initPrompt = '请回应方括号中的内容，不超过20字。如果是名词，给出简要解释。如果是提问，直接给出回答，但注意不要超过20字。如果是命令，可以执行，但不得超过20字。';
            gameState.modelTemperature = 0.7;
        }

        // 更新界面
        document.getElementById('disableEnglish').checked = gameState.disableEnglish;
        document.getElementById('apiUrl').value = gameState.apiUrl;
        document.getElementById('apiKey').value = gameState.apiKey;
        document.getElementById('modelName').value = gameState.modelName;
        document.getElementById('modelTemperature').value = gameState.modelTemperature;
        document.getElementById('initPrompt').value = gameState.initPrompt;

        document.getElementById('modelTemperatureValue').textContent = gameState.modelTemperature;
        document.getElementById('modelTemperature').removeEventListener('input', null);
        document.getElementById('modelTemperature').addEventListener('input', function () {
            document.getElementById('modelTemperatureValue').textContent = this.value;
        });
    }

    initTheme();
}

// 切换主题
function toggleTheme() {
    gameState.theme = gameState.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', gameState.theme);
    localStorage.setItem('theme', gameState.theme);

    // Force re-render of inputs to update their styles
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.style.display = 'none';
        setTimeout(() => input.style.display = '', 0);
    });
}

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    gameState.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// 显示成功模态框
function showSuccessModal() {
    const endTime = new Date();
    const timeDiff = Math.floor((endTime - gameState.startTime) / 1000);
    const minutes = Math.floor(timeDiff / 60);
    const seconds = timeDiff % 60;

    document.getElementById('successTarget').textContent = gameState.targetWord;
    document.getElementById('successTime').textContent = `${minutes}分${seconds}秒`;
    document.getElementById('successMoves').textContent = gameState.chatHistory.length / 2;

    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('successModal');
    overlay.classList.add('show');
    modal.classList.remove('hiding');
    modal.style.display = 'block';
}

function closeSuccessModal() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('successModal');

    modal.classList.add('hiding');
    setTimeout(() => {
        overlay.classList.remove('show');
        modal.style.display = 'none';
        modal.classList.remove('hiding');
    }, 300);
}

// 分享结果
function shareResult() {
    const moves = gameState.chatHistory.length / 2;
    const timeDiff = Math.floor((new Date() - gameState.startTime) / 1000);
    const minutes = Math.floor(timeDiff / 60);
    const seconds = timeDiff % 60;

    let shareText = `我在词出变游戏中找到了"${gameState.targetWord}"！🥰
⏰ 用时：${minutes} 分 ${seconds} 秒
💬 对话次数：${moves}
🧐 初始字库：${gameState.initBank}
尝试一下 👉 ` + encodeURI(`https://iceddog.github.io/ccb-puzzle?target=${gameState.targetWord}&bank=${gameState.initBank}`);

    if (window.isChallenge) {
        shareText = `我在今日的词出变挑战内取得了成功！🎖️ ${date}
⏰ 用时：${minutes} 分 ${seconds} 秒
💬 对话次数：${moves}
你也来试试吧 👉 ` + encodeURI(`https://iceddog.github.io/ccb-puzzle/challenge/`);
    }

    navigator.clipboard.writeText(shareText).then(() => {
        showToast('游戏记录已复制到剪贴板', '#2ecc71');
    }).catch(err => {
        showToast('复制失败: ' + err, '#e74c3c');
    });
}

// 键盘事件
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('userInput').value && gameState.isGameActive) {
        const input = document.getElementById('userInput');
        const submitBtn = document.getElementById('submitBtn');

        // 只有在输入有效且提交按钮可用时才提交
        if (!input.classList.contains('invalid') && !submitBtn.disabled) {
            submitQuestion();
        }
    }
});

function copyBank() {
    const bank = Array.from(gameState.characterBank).join('');
    navigator.clipboard.writeText(bank).then(() => {
        showToast('字库已复制到剪贴板', '#2ecc71');
    }).catch(err => {
        showToast('复制失败: ' + err, '#e74c3c');
    });
}

function pasteBank() {
    navigator.clipboard.readText().then(text => {
        const chars = new Set(text.trim().split(''));
        gameState.characterBank = new Set();
        for (let char of chars) {
            if (gameState.disableEnglish && !isChinese(char) && !isPunctuation(char)) {
                continue;
            }
            if (!isPunctuation(char)) gameState.characterBank.add(char);
        }
        updateCharacterGrid();
        showToast('字库已粘贴', '#2ecc71');
    }).catch(err => {
        showToast('粘贴失败: ' + err, '#e74c3c');
    });
}

function exportChat() {
    const chatHistory = gameState.chatHistory.map(chat => {
        const timestamp = new Date(chat.timestamp).toLocaleString();
        return `${chat.isUser ? '我' : 'AI'}: ${chat.content} (${timestamp})`;
    }).join('\n');
    const file = new File([chatHistory], 'chat.txt', { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = 'chat.txt';
    a.click();
}

function showToast(str, color) {
    const x = document.getElementById("toast");
    x.className = "show";
    x.style.backgroundColor = color;
    x.innerHTML = str;
    setTimeout(function () { x.className = x.className.replace("show", ""); }, 3000);
}

const Confettiful = function (el) {
    this.el = el;
    this.containerEl = null;

    this.confettiFrequency = 3;
    this.confettiColors = ['#EF2964', '#00C09D', '#2D87B0', '#48485E', '#EFFF1D'];
    this.confettiAnimations = ['slow', 'medium', 'fast'];

    this._setupElements();
};

Confettiful.prototype._setupElements = function () {
    const containerEl = document.createElement('div');
    containerEl.classList.add('confetti-container');
    this.el.appendChild(containerEl);
    this.containerEl = containerEl;
};

Confettiful.prototype._renderConfetti = function () {
    this.confettiInterval = setInterval(() => {
        const confettiEl = document.createElement('div');
        const confettiSize = (Math.floor(Math.random() * 3) + 7) + 'px';
        const confettiBackground = this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)];
        const confettiLeft = (Math.floor(Math.random() * this.el.offsetWidth)) + 'px';
        const confettiAnimation = this.confettiAnimations[Math.floor(Math.random() * this.confettiAnimations.length)];

        confettiEl.classList.add('confetti', 'confetti--animation-' + confettiAnimation);
        confettiEl.style.left = confettiLeft;
        confettiEl.style.width = confettiSize;
        confettiEl.style.height = confettiSize;
        confettiEl.style.backgroundColor = confettiBackground;

        confettiEl.removeTimeout = setTimeout(function () {
            confettiEl.parentNode.removeChild(confettiEl);
        }, 3000);

        this.containerEl.appendChild(confettiEl);
    }, 25);
};

Confettiful.prototype._stopConfetti = function () {
    clearInterval(this.confettiInterval);
};

const confettiElement = document.getElementsByClassName('js-container')[0];
const confetti = new Confettiful(confettiElement);

function spawnConfetti(timeout = 2000) {
    confetti._renderConfetti();
    setTimeout(() => {
        confetti._stopConfetti();
    }, timeout);
}

// 初始化
window.addEventListener('load', () => {
    init();
    initTheme();
});

// Add close modal on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (modal.id === 'successModal') {
                closeSuccessModal();
            } else {
                closeSettings();
            }
        }
    });
});

// Close modals on overlay click
document.getElementById('overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('overlay')) {
        closeSuccessModal();
    }
});

async function refreshLatestChat() {
    if (gameState.chatHistory.length === 0) {
        showToast('没有可刷新的对话', '#e74c3c');
        return;
    }

    const lastUserMessage = gameState.chatHistory[gameState.chatHistory.length - 2];
    if (!lastUserMessage || !lastUserMessage.isUser) {
        showToast('没有找到上一条提问', '#e74c3c');
        return;
    }

    // Remove the last AI response from chat history
    gameState.chatHistory.pop();
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.removeChild(chatContainer.lastChild);

    // Remove the last AI respoense from character bank
    for (let item of gameState.lastAddedChars) {
        gameState.characterBank.delete(item);
    }

    // Show loading message
    showLoadingMessage();

    try {
        const response = await callAI(lastUserMessage.content);
        removeLoadingMessage();
        addChatMessage(response, false);

        // Add new characters to bank
        addResponseToBank(response);
        updateCharacterGrid();

        // Check win condition
        if (checkWinCondition(response)) {
            showSuccess();
            showSuccessModal();
        }

        showToast('刷新成功', '#2ecc71');
    } catch (error) {
        removeLoadingMessage();
        showToast('刷新失败：' + error.message, '#e74c3c');

        // Restore the previous AI response
        addChatMessage(gameState.chatHistory[gameState.chatHistory.length - 1].content, false);
    }
}