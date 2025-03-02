// 配置对象
const CONFIG = {
    MAX_ATTACHMENTS: 5,
    API_ENDPOINT: 'https://api.deepseek.com/v1/chat/completions',
    API_MODEL: 'deepseek-chat',
    API_KEY: 'sk-aa27b257a6f340acad96a6a733782c72',
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

// 工具函数
const utils = {
    isEnglishRequired(content) {
        return content.toLowerCase().includes('用英文') || 
               content.toLowerCase().includes('用英语') || 
               content.toLowerCase().includes('in english');
    },

    cleanContent(content) {
        return content.replace(/用英文回复|用英文|用英语|in english/gi, '').trim();
    },

    validateAttachments(currentCount) {
        if (currentCount >= CONFIG.MAX_ATTACHMENTS) {
            throw new Error(`最多只能添加${CONFIG.MAX_ATTACHMENTS}个附件`);
        }
    },

    insertAtCursor(element, text) {
        if (document.selection) {
            element.focus();
            const sel = document.selection.createRange();
            sel.text = text;
        } else if (element.selectionStart || element.selectionStart === 0) {
            const startPos = element.selectionStart;
            const endPos = element.selectionEnd;
            element.value = element.value.substring(0, startPos) + text + element.value.substring(endPos);
        } else {
            element.innerHTML += text;
        }
    },

    // 清空所有内容的函数 - 适用于邮件功能区域
    clearAllContent() {
        // 清空输入框中的文字和图片
        const contentEditor = document.querySelector('.feature-container[data-feature="email"] .content-editor');
        if (contentEditor) {
            contentEditor.innerHTML = '';
            // 重置 placeholder
            contentEditor.setAttribute('data-empty', 'true');
        }

        // 清空附件列表
        const attachmentsList = document.querySelector('.feature-container[data-feature="email"] .attachments-list');
        if (attachmentsList) {
            attachmentsList.innerHTML = '';
        }

        // 清空附件数组
        window.attachments = [];

        // 重置预览区域
        const previewContent = document.querySelector('.feature-container[data-feature="email"] .preview-content');
        if (previewContent) {
            previewContent.innerHTML = '<p class="placeholder-text">AI 将根据您的输入生成内容...</p>';
        }
    },

    // 统一的错误提示显示函数
    showMessage(previewContent, type, message, detail = '') {
        const messages = {
            error: {
                class: 'error-message',
                color: '#ff4757'
            },
            loading: {
                class: 'loading',
                color: '#666'
            },
            placeholder: {
                class: 'placeholder-text',
                color: '#666'
            }
        };

        const messageType = messages[type];
        previewContent.innerHTML = `
            <div class="${messageType.class}">
                ${message}
                ${detail ? `<div class="error-detail">${detail}</div>` : ''}
            </div>
        `;
    },

    // 显示加载状态
    showLoading(previewContent) {
        this.showMessage(previewContent, 'loading', '请稍候，这可能需要几秒钟时间');
    },

    // 显示生成的回复
    displayResponse(response, previewContent) {
        if (!response) {
            throw new Error('未能获取到有效的回复');
        }

        // 清理响应文本，移除开头的空格和多余的换行
        const cleanedResponse = response
            .replace(/^\s+/, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // 显示处理后的内容 - 替换换行符为<br>以在HTML中正确显示
        previewContent.innerHTML = cleanedResponse.replace(/\n/g, '<br>');
    },

    validateImage(file) {
        if (!file) {
            throw new Error('无效的图片文件');
        }

        // 检查文件类型
        if (!CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
            throw new Error('不支持的图片格式，请使用 JPG、PNG、GIF 或 WebP 格式');
        }

        // 检查文件大小
        if (file.size > CONFIG.MAX_IMAGE_SIZE) {
            throw new Error(`图片大小不能超过 ${CONFIG.MAX_IMAGE_SIZE / 1024 / 1024}MB`);
        }

        return true;
    }
};

// 动画系统初始化
function initAnimations() {
    const sections = document.querySelectorAll('.section');
    const indicators = document.querySelectorAll('.indicator');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // 更新导航和指示器状态的函数
    function updateNavigationState(activeSection) {
        if (!activeSection) return;

        const sectionIndex = Array.from(sections).indexOf(activeSection);
        
        // 更新指示器状态
        indicators.forEach(ind => ind.classList.remove('active'));
        if (indicators[sectionIndex]) {
            indicators[sectionIndex].classList.add('active');
        }

        // 更新导航状态
        navLinks.forEach(link => link.classList.remove('active'));
        const sectionId = activeSection.id;
        const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // 更新section状态，添加动画效果
        sections.forEach(section => {
            section.classList.remove('active');
        });
        activeSection.classList.add('active');
    }

    // 处理滚动到指定section的函数
    function scrollToSection(section) {
        if (section) {
            // 更新URL hash，但不触发滚动
            const sectionId = section.id;
            history.replaceState(null, '', `#${sectionId}`);
            
            // 计算目标滚动位置
            const offset = section.offsetTop;
            
            // 首先移除所有section的active类
            sections.forEach(s => {
                s.classList.remove('active');
            });
            
            // 使用scrollTo而不是scrollIntoView，以确保精确定位
            window.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
            
            // 立即更新导航状态
            updateNavigationState(section);
            
            // 等待一段时间后添加active类，触发动画
            setTimeout(() => {
                section.classList.add('active');
            }, 300);
        }
    }

    // 滚动处理函数
    function scrollHandler() {
        // 如果初始加载尚未完成，则不触发滚动处理
        if (!initialLoadComplete) {
            return;
        }
        
        // 获取当前滚动位置
        const scrollPosition = window.scrollY;
        
        // 查找当前在视口中的section
        let currentSection = null;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            // 判断当前section是否在视口中
            if (scrollPosition >= sectionTop - 200 && scrollPosition < sectionTop + sectionHeight - 200) {
                currentSection = section;
            }
        });
        
        // 如果找到了当前section，更新导航状态
        if (currentSection) {
            updateNavigationState(currentSection);
        }
    }

    // 监听滚动事件来更新导航状态
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        // 使用防抖来减少更新频率
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            scrollHandler();
        }, 100);
    }, { passive: true });

    // 导航点击事件处理
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const section = document.getElementById(targetId);
            scrollToSection(section);
        });
    });

    // 指示器点击事件处理
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            scrollToSection(sections[index]);
        });
    });

    // 初始化页面状态
    function initializePageState() {
        // 如果初始加载尚未完成，则等待window.onload函数处理
        if (!initialLoadComplete) {
            return;
        }
        
        // 无论当前hash是什么，总是跳转到首页
        const targetSection = sections[0];
        
        if (targetSection) {
            // 计算目标滚动位置
            const offset = targetSection.offsetTop;
            
            // 使用scrollTo而不是scrollIntoView，以确保精确定位
            window.scrollTo({
                top: offset,
                behavior: 'auto'
            });
            
            // 立即更新导航状态
            updateNavigationState(targetSection);
            
            // 延迟一小段时间后添加active类，以便触发动画
            setTimeout(() => {
                targetSection.classList.add('active');
            }, 100);
        }
    }

    // 页面加载完成后初始化状态
    window.addEventListener('load', initializePageState);
}

// 防止某些滚动操作中断首页跳转
let initialLoadComplete = false;

// 初始化所有功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化动画系统
    initAnimations();
    
    // 初始化功能切换
    initFeatureSwitch();
    
    // 初始化 AI 功能
    initAIFeatures();
    
    // 确保所有section默认可见
    document.querySelectorAll('.section').forEach(section => {
        section.style.opacity = "1";
        section.style.transform = "translateY(0)";
    });
});

// 在页面完全加载后（包括图片和样式），强制跳转到首页
window.onload = function() {
    // 标记初始加载完成
    initialLoadComplete = true;
    
    // 初始化页面状态
    initializePageState();
    
    // 确保首页section有active类
    if (sections[0] && !sections[0].classList.contains('active')) {
        sections[0].classList.add('active');
    }
    
    // 强制滚动到页面顶部
    window.scrollTo(0, 0);
    
    // 更新URL为首页
    if (window.location.hash !== '#home') {
        history.replaceState(null, '', '#home');
    }
    
    // 更新导航状态
    const navLinks = document.querySelectorAll('.nav-link');
    const indicators = document.querySelectorAll('.indicator');
    
    // 设置第一个导航和指示器为活跃状态
    navLinks.forEach(link => link.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));
    
    const homeLink = document.querySelector('.nav-link[data-index="0"]');
    const homeIndicator = document.querySelector('.indicator[data-index="0"]');
    
    if (homeLink) homeLink.classList.add('active');
    if (homeIndicator) homeIndicator.classList.add('active');
    
    // 延迟一小段时间后将初始加载标记为完成
    setTimeout(() => {
        initialLoadComplete = true;
    }, 100);
};

// 添加一个防护措施，如果用户直接访问非首页URL，也会重定向到首页
if (window.location.hash && window.location.hash !== '#home') {
    window.location.hash = 'home';
}

// 功能切换初始化
function initFeatureSwitch() {
    const featureTabs = document.querySelectorAll('.feature-tab');
    const featureContainers = document.querySelectorAll('.feature-container');

    featureTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const feature = this.dataset.feature;

            // 更新标签状态
            featureTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // 更新容器显示
            featureContainers.forEach(container => {
                container.classList.remove('active');
                if (container.dataset.feature === feature) {
                    container.classList.add('active');
                }
            });
        });
    });
}

// AI 功能初始化
function initAIFeatures() {
    // 获取所有功能相关的DOM元素
    const elements = {
        featureTabs: document.querySelectorAll('.feature-tab'),
        featureContainers: document.querySelectorAll('.feature-container'),
        // 邮件功能元素
        emailSendBtn: document.querySelector('.feature-container[data-feature="email"] .send-btn'),
        emailContentEditor: document.querySelector('.feature-container[data-feature="email"] .content-editor'),
        emailPreviewContent: document.querySelector('.feature-container[data-feature="email"] .preview-content'),
        emailCopyBtn: document.querySelector('.feature-container[data-feature="email"] .copy-btn'),
        emailAttachmentBtn: document.querySelector('.feature-container[data-feature="email"] .attachment-btn'),
        emailFileUpload: document.querySelector('.feature-container[data-feature="email"] #file-upload'),
        emailAttachmentsList: document.querySelector('.feature-container[data-feature="email"] .attachments-list'),
        emailClearBtn: document.querySelector('.feature-container[data-feature="email"] .tool-btn[title="清空内容"]'),
        // 翻译功能元素
        translateSendBtn: document.querySelector('.feature-container[data-feature="translate"] .send-btn'),
        translateContentEditor: document.querySelector('.feature-container[data-feature="translate"] .content-editor'),
        translatePreviewContent: document.querySelector('.feature-container[data-feature="translate"] .preview-content'),
        translateCopyBtn: document.querySelector('.feature-container[data-feature="translate"] .copy-btn'),
        translateClearBtn: document.querySelector('.feature-container[data-feature="translate"] .tool-btn[title="清空内容"]'),
        translateLanguageSelector: document.querySelector('.feature-container[data-feature="translate"] .language-selector')
    };

    // 存储附件列表
    window.attachments = [];

    // 功能切换
    elements.featureTabs?.forEach(tab => {
        tab.addEventListener('click', () => handleFeatureSwitch(tab, elements));
    });

    // ==== 邮件功能 ====
    // 清空内容按钮
    elements.emailClearBtn?.addEventListener('click', () => {
        utils.clearAllContent();
    });

    // 内容编辑器粘贴事件
    if (elements.emailContentEditor) {
        elements.emailContentEditor.addEventListener('paste', async function(e) {
            e.preventDefault();
            
            // 处理图片粘贴
            const items = Array.from(e.clipboardData.items);
            let hasHandledImage = false;

            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    try {
                        const file = item.getAsFile();
                        if (file) {
                            utils.validateImage(file);
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                const img = document.createElement('img');
                                img.src = e.target.result;
                                img.style.maxWidth = '100%';
                                img.style.height = 'auto';
                                img.style.margin = '10px 0';
                                img.style.borderRadius = '4px';
                                
                                // 插入图片
                                elements.emailContentEditor.appendChild(img);
                                // 添加换行
                                elements.emailContentEditor.appendChild(document.createElement('br'));
                            };
                            reader.readAsDataURL(file);
                            hasHandledImage = true;
                            break;
                        }
                    } catch (error) {
                        console.error('图片处理错误:', error);
                        alert(error.message);
                        return;
                    }
                }
            }
            
            // 如果没有处理图片，则处理文本
            if (!hasHandledImage) {
            const text = e.clipboardData.getData('text/plain');
            if (text) {
                document.execCommand('insertText', false, text);
                }
            }
        });
    }

    // 附件处理
    if (elements.emailAttachmentBtn && elements.emailFileUpload) {
        initializeFileUpload(elements, window.attachments);
    }

    // 生成邮件内容按钮点击事件
    elements.emailSendBtn?.addEventListener('click', async () => {
        try {
            const content = elements.emailContentEditor?.innerText;
            
            if (!content?.trim()) {
                utils.showMessage(
                    elements.emailPreviewContent,
                    'error',
                    '<p class="placeholder-text">请输入内容后再生成</p>'
                );
                return;
            }

            utils.showLoading(elements.emailPreviewContent);
            const response = await generateEmailResponse(content, window.attachments);
            utils.displayResponse(response, elements.emailPreviewContent);

        } catch (error) {
            utils.showMessage(
                elements.emailPreviewContent,
                'error',
                '生成内容时发生错误',
                '请稍后重试'
            );
            console.error('Error:', error);
        }
    });

    // 邮件复制按钮功能
    elements.emailCopyBtn?.addEventListener('click', () => {
        const content = elements.emailPreviewContent?.innerText;
        if (content && content !== 'AI 将根据您的输入生成内容...') {
            navigator.clipboard.writeText(content)
                .then(() => alert('已复制到剪贴板'))
                .catch(() => alert('复制失败，请手动复制'));
        }
    });

    // ==== 翻译功能 ====
    // 翻译清空按钮
    elements.translateClearBtn?.addEventListener('click', () => {
        if (elements.translateContentEditor) {
            elements.translateContentEditor.innerHTML = '';
            elements.translateContentEditor.setAttribute('data-empty', 'true');
        }
        if (elements.translatePreviewContent) {
            elements.translatePreviewContent.innerHTML = '<p class="placeholder-text">AI 将根据您的输入生成内容...</p>';
        }
    });

    // 翻译按钮
    elements.translateSendBtn?.addEventListener('click', async () => {
        try {
            const content = elements.translateContentEditor?.innerText;
            
            if (!content?.trim()) {
                elements.translatePreviewContent.innerHTML = '<p class="placeholder-text">请输入内容后再翻译</p>';
                return;
            }

            // 获取语言选择
            const targetLanguage = elements.translateLanguageSelector?.value || 'en';
            
            // 显示加载状态
            elements.translatePreviewContent.innerHTML = '<div class="loading">正在翻译，请稍候...</div>';
            
            // 发送翻译请求
            const response = await translateText(content, 'auto', targetLanguage);
            
            // 显示翻译结果
            elements.translatePreviewContent.innerHTML = response.replace(/\n/g, '<br>');

        } catch (error) {
            elements.translatePreviewContent.innerHTML = `<div class="error-message">
                翻译失败
                <div class="error-detail">${error.message || '请稍后重试'}</div>
            </div>`;
            console.error('Error:', error);
        }
    });

    // 翻译复制按钮功能
    elements.translateCopyBtn?.addEventListener('click', () => {
        const content = elements.translatePreviewContent?.innerText;
        if (content && content !== 'AI 将根据您的输入生成内容...') {
            navigator.clipboard.writeText(content)
                .then(() => alert('已复制到剪贴板'))
                .catch(() => alert('复制失败，请手动复制'));
        }
    });
}

// 处理功能切换
function handleFeatureSwitch(selectedTab, elements) {
    // 获取选中功能的名称
    const selectedFeature = selectedTab.getAttribute('data-feature');
    
    // 更新选项卡状态
    elements.featureTabs.forEach(tab => {
        const feature = tab.getAttribute('data-feature');
        if (feature === selectedFeature) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // 更新内容容器
    elements.featureContainers.forEach(container => {
        const feature = container.getAttribute('data-feature');
        if (feature === selectedFeature) {
            container.classList.add('active');
        } else {
            container.classList.remove('active');
        }
    });
}

// 初始化文件上传
function initializeFileUpload(elements, attachments) {
    elements.emailAttachmentBtn.addEventListener('click', () => {
        elements.emailFileUpload.click();
    });

    elements.emailFileUpload.addEventListener('change', (e) => {
        try {
            const files = Array.from(e.target.files || []);
            files.forEach(file => {
                utils.validateAttachments(window.attachments.length);
                window.attachments.push(file);
                displayAttachment(file, elements.emailAttachmentsList);
            });
            elements.emailFileUpload.value = '';
        } catch (error) {
            alert(error.message);
        }
    });
}

// 显示附件
function displayAttachment(file, attachmentsList) {
    const div = document.createElement('div');
    div.className = 'attachment-item';
    div.innerHTML = `
        <span class="file-name">${file.name}</span>
        <button class="remove-file">×</button>
    `;
    attachmentsList.appendChild(div);

    div.querySelector('.remove-file')?.addEventListener('click', () => {
        window.attachments = window.attachments.filter(f => f.name !== file.name);
        div.remove();
    });
}

// 生成邮件回复
async function generateEmailResponse(content, attachments = []) {
    const systemPrompt = `你是一个专业的邮件助手，需要帮助用户处理邮件回复。请严格按照以下规则处理：
    1. 保持专业、礼貌的语气
    2. 回复格式规范，包含称呼、正文、结束语
    3. 根据用户的需求和附件信息，生成合适的回复内容
    4. 如果用户要求英文回复，同时提供中文译文
    5. 直接使用"Best regards"作为结束语，不要添加模板化的签名信息
    6. 保持邮件格式简洁专业，避免不必要的占位符
    7. 不要在邮件开头添加额外的空格和换行
    8. 每个段落之间只使用一个空行分隔`;

    try {
        const isEnglishRequired = utils.isEnglishRequired(content);
        const cleanContent = utils.cleanContent(content);

        const userPrompt = `请帮我回复以下邮件内容：${cleanContent}
${isEnglishRequired ? '请用英文回复，并在回复后附上中文译文。' : '请用中文回复。'}
${attachments.length > 0 ? `附件列表：\n${attachments.map(file => `- ${file.name}`).join('\n')}` : ''}`;

        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.API_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                stream: false,
                temperature: 0.7,
                max_tokens: 2000,
                top_p: 0.95
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'AI 服务请求失败');
        }

        const result = await response.json();
        return result.choices[0].message.content;

    } catch (error) {
        console.error('生成回复失败:', error);
        throw new Error('生成回复时发生错误，请稍后重试');
    }
}

// 翻译功能实现
async function translateText(content, sourceLanguage = 'auto', targetLanguage = 'en') {
    const systemPrompt = `你是一个专业的翻译助手。请严格按照以下规则处理翻译：
    1. 准确传达原文的意思和语气
    2. 使用自然流畅的表达方式
    3. 保留原文的段落结构
    4. 专业术语应使用对应语言中的标准翻译`;

    try {
        // 确保内容不为空
        if (!content?.trim()) {
            throw new Error('请输入要翻译的文本');
        }

        let promptText = '';
        if (sourceLanguage === 'auto') {
            promptText = `请翻译以下文本为${targetLanguage === 'en' ? '英文' : targetLanguage === 'zh' ? '中文' : targetLanguage === 'ja' ? '日文' : '目标语言'}：\n\n${content}`;
        } else {
            promptText = `请将以下${sourceLanguage === 'zh' ? '中文' : sourceLanguage === 'en' ? '英文' : sourceLanguage === 'ja' ? '日文' : '源语言'}文本翻译为${targetLanguage === 'en' ? '英文' : targetLanguage === 'zh' ? '中文' : targetLanguage === 'ja' ? '日文' : '目标语言'}：\n\n${content}`;
        }

        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.API_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: promptText }
                ],
                stream: false,
                temperature: 0.3, // 翻译需要更低的创造性
                max_tokens: 2000,
                top_p: 0.95
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'AI 服务请求失败');
        }

        const result = await response.json();
        return result.choices[0].message.content;
    } catch (error) {
        console.error('翻译失败:', error);
        throw new Error('翻译过程中发生错误，请稍后重试');
    }
}

// 获取API Key的函数（需要实现）
async function getApiKey() {
    // TODO: 从安全的地方获取API Key
    // 可以是环境变量、后端API、加密存储等
    throw new Error('请配置API Key');
} 