// 配置对象
const CONFIG = {
    MAX_ATTACHMENTS: 5,
    API_ENDPOINT: 'https://api.deepseek.com/v1/chat/completions',
    API_MODEL: 'deepseek-chat',
    API_KEY: 'sk-ce5f0690af0d454cb4a08054db2b9102',
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

    // 清空所有内容的函数
    clearAllContent() {
        // 清空输入框中的文字和图片
        const contentEditor = document.querySelector('.content-editor');
        if (contentEditor) {
            contentEditor.innerHTML = '';
            // 重置 placeholder
            contentEditor.setAttribute('data-empty', 'true');
        }

        // 清空附件列表
        const attachmentsList = document.querySelector('.attachments-list');
        if (attachmentsList) {
            attachmentsList.innerHTML = '';
        }

        // 清空附件数组
        window.attachments = [];

        // 重置预览区域
        const previewContent = document.querySelector('.preview-content');
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

        // 显示处理后的内容
        previewContent.innerHTML = cleanedResponse;
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
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5
    };

    // 记录已经播放过动画的section
    const animatedSections = new Set();
    // 记录目标section
    let targetSection = null;
    // 记录是否正在快速跳转
    let isQuickJumping = false;
    // 快速跳转的超时时间
    const QUICK_JUMP_TIMEOUT = 1000;
    let quickJumpTimer = null;
    // 记录滚动方向
    let lastScrollY = window.scrollY;
    let scrollDirection = 'down';
    // 记录上一个激活的section
    let lastActiveSection = null;

    // 重置section的动画状态
    function resetSectionAnimation(section, isHome = false) {
        if (!section) return;

        // 移除active类
        section.classList.remove('active');
        
        // 重置所有子元素的动画状态
        const projectCards = section.querySelectorAll('.project-card');
        const musicCards = section.querySelectorAll('.music-card');
        const featureTabs = section.querySelectorAll('.feature-tab');
        const featureContainer = section.querySelector('.feature-container.active');
        
        // 重置动画
        const resetAnimation = (element) => {
            if (element) {
                element.style.animation = 'none';
                element.offsetHeight; // 触发重排
                element.style.animation = null;
                // 如果是首页元素，重置动画延迟
                if (isHome) {
                    element.style.animationDelay = element.dataset.originalDelay || '0s';
                }
            }
        };
        
        projectCards.forEach(resetAnimation);
        musicCards.forEach(resetAnimation);
        featureTabs.forEach(resetAnimation);
        resetAnimation(featureContainer);
        
        // 强制重排
        void section.offsetHeight;
        
        // 添加active类触发动画
        requestAnimationFrame(() => {
            section.classList.add('active');
        });
    }

    // 处理首页动画的专门函数
    function handleHomeAnimation(section, isScrolling = false) {
        if (!section || section.id !== 'home') return;
        
        // 移除所有动画相关的状态
        animatedSections.delete(section);
        section.classList.remove('active');
        
        // 获取所有需要动画的元素
        const title = section.querySelector('.hero-title');
        const subtitle = section.querySelector('.hero-subtitle');
        const buttons = section.querySelector('.hero-buttons');
        
        // 重置所有元素的状态
        [title, subtitle, buttons].forEach(element => {
            if (element) {
                element.style.opacity = '0';
                element.style.transform = 'translateY(30px)';
                element.style.transition = 'none';
            }
        });
        
        // 强制重排
        void section.offsetHeight;

        // 如果是滚动触发，添加延迟等待滚动完成
        const scrollDelay = isScrolling ? 300 : 0;
        
        // 按顺序应用动画
        setTimeout(() => {
            requestAnimationFrame(() => {
                section.classList.add('active');
                
                if (title) {
                    title.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                    title.style.opacity = '1';
                    title.style.transform = 'translateY(0)';
                }
                
                if (subtitle) {
                    setTimeout(() => {
                        subtitle.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                        subtitle.style.opacity = '1';
                        subtitle.style.transform = 'translateY(0)';
                    }, 150);
                }
                
                if (buttons) {
                    setTimeout(() => {
                        buttons.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                        buttons.style.opacity = '1';
                        buttons.style.transform = 'translateY(0)';
                    }, 300);
                }
            });
        }, scrollDelay);
    }

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

        // 更新上一个激活的section
        lastActiveSection = activeSection;
    }

    // 处理滚动到指定section的函数
    function scrollToSection(section) {
        if (section) {
            const currentIndex = Array.from(sections).indexOf(document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2).closest('.section'));
            const targetIndex = Array.from(sections).indexOf(section);
            scrollDirection = targetIndex > currentIndex ? 'down' : 'up';
            
            // 设置快速跳转状态
            isQuickJumping = true;
            targetSection = section;
            
            // 清除之前的定时器
            if (quickJumpTimer) {
                clearTimeout(quickJumpTimer);
            }
            
            // 更新URL hash，但不触发滚动
            const sectionId = section.id;
            history.replaceState(null, '', `#${sectionId}`);
            
            // 计算目标滚动位置
            const offset = section.offsetTop;
            
            // 使用scrollTo而不是scrollIntoView，以确保精确定位
            window.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
            
            // 立即更新导航状态
            updateNavigationState(section);

            // 如果是首页，使用专门的动画处理函数，并标记为滚动触发
            if (section.id === 'home') {
                handleHomeAnimation(section, true);
            }
            // 如果是目标页面，重置并播放动画
            else if (section === targetSection) {
                // 从animatedSections中移除目标section，允许重新播放动画
                animatedSections.delete(section);
                setTimeout(() => {
                    resetSectionAnimation(section);
                }, 300); // 添加300ms延迟，等待滚动开始
            }
            
            // 设置超时，如果超过一定时间还没到达目标section，就取消快速跳转状态
            quickJumpTimer = setTimeout(() => {
                isQuickJumping = false;
                targetSection = null;
            }, QUICK_JUMP_TIMEOUT);
        }
    }

    // 监听滚动事件来更新滚动方向和导航状态
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        scrollDirection = window.scrollY > lastScrollY ? 'down' : 'up';
        lastScrollY = window.scrollY;

        // 使用防抖来减少更新频率
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            // 找到当前最接近视口中心的section
            const viewportCenter = window.innerHeight / 2;
            let closestSection = null;
            let minDistance = Infinity;

            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestSection = section;
                }
            });

            if (closestSection && closestSection !== lastActiveSection) {
                updateNavigationState(closestSection);
            }
        }, 100);
    }, { passive: true });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // 如果正在快速跳转且当前section不是目标section，跳过动画
            if (isQuickJumping && entry.target !== targetSection) {
                return;
            }

            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                // 首页特殊处理：使用专门的动画处理函数，并标记为滚动触发
                if (entry.target.id === 'home') {
                    handleHomeAnimation(entry.target, true);
                    return;
                }

                // 其他页面：如果是目标section或不在快速跳转中，播放动画
                if (!isQuickJumping || entry.target === targetSection) {
                    // 重置并播放动画
                    resetSectionAnimation(entry.target);
                }

                // 如果是目标section，结束快速跳转状态
                if (entry.target === targetSection) {
                    isQuickJumping = false;
                    targetSection = null;
                }
            } else {
                // 只有当元素完全离开视图时才重置动画状态
                if (entry.intersectionRatio === 0) {
                    // 允许所有section在下次进入视图时重新播放动画
                    animatedSections.delete(entry.target);
                }
            }
        });
    }, options);

    sections.forEach(section => {
        observer.observe(section);
    });

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
        // 获取当前hash
        const hash = window.location.hash;
        const targetSection = hash ? document.querySelector(hash) : sections[0];
        
        if (targetSection) {
            // 计算目标滚动位置
            const offset = targetSection.offsetTop;
            
            // 使用scrollTo精确定位
            window.scrollTo({
                top: offset,
                behavior: 'auto'
            });
            
            // 更新状态
            updateNavigationState(targetSection);

            // 如果是首页，使用专门的动画处理函数
            if (targetSection.id === 'home') {
                handleHomeAnimation(targetSection);
            } else {
                // 其他页面正常处理
                resetSectionAnimation(targetSection);
                animatedSections.add(targetSection);
            }
        }
    }

    // 页面加载完成后初始化状态
    window.addEventListener('load', initializePageState);
}

// 初始化所有功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化动画系统
    initAnimations();
    
    // 初始化功能切换
    initFeatureSwitch();
    
    // 初始化 AI 功能
    initAIFeatures();
});

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
        sendBtn: document.querySelector('.send-btn'),
        contentEditor: document.querySelector('.content-editor'),
        previewContent: document.querySelector('.preview-content'),
        copyBtn: document.querySelector('.copy-btn'),
        attachmentBtn: document.querySelector('.attachment-btn'),
        fileUpload: document.querySelector('#file-upload'),
        attachmentsList: document.querySelector('.attachments-list'),
        clearBtn: document.querySelector('.tool-btn[title="清空内容"]'),
        grammarBtn: document.querySelector('.tool-btn[title="语法检查"]')
    };

    // 存储附件列表
    window.attachments = [];

    // 功能切换
    elements.featureTabs?.forEach(tab => {
        tab.addEventListener('click', () => handleFeatureSwitch(tab, elements));
    });

    // 清空内容按钮
    elements.clearBtn?.addEventListener('click', () => {
        utils.clearAllContent();
    });

    // 内容编辑器粘贴事件
    if (elements.contentEditor) {
        elements.contentEditor.addEventListener('paste', async function(e) {
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
                                elements.contentEditor.appendChild(img);
                                // 添加换行
                                elements.contentEditor.appendChild(document.createElement('br'));
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

    // 语法检查按钮
    elements.grammarBtn?.addEventListener('click', () => {
        try {
            utils.validateContent(elements.contentEditor?.innerText);
            // TODO: 实现语法检查功能
            alert('语法检查功能即将上线');
        } catch (error) {
            alert(error.message);
        }
    });

    // 附件处理
    if (elements.attachmentBtn && elements.fileUpload) {
        initializeFileUpload(elements, window.attachments);
    }

    // 生成内容按钮点击事件
    elements.sendBtn?.addEventListener('click', async () => {
        try {
            const content = elements.contentEditor?.innerText;
            
            if (!content?.trim()) {
                utils.showMessage(
                    elements.previewContent,
                    'error',
                    '<p class="placeholder-text">请输入内容后再生成</p>'
                );
                return;
            }

            utils.showLoading(elements.previewContent);
            const response = await generateEmailResponse(content, window.attachments);
            utils.displayResponse(response, elements.previewContent);

        } catch (error) {
            utils.showMessage(
                elements.previewContent,
                'error',
                '生成内容时发生错误',
                '请稍后重试'
            );
            console.error('Error:', error);
        }
    });

    // 复制按钮功能
    elements.copyBtn?.addEventListener('click', () => {
        const content = elements.previewContent?.innerText;
        if (content) {
            navigator.clipboard.writeText(content)
                .then(() => alert('已复制到剪贴板'))
                .catch(() => alert('复制失败，请手动复制'));
        }
    });
}

// 功能切换处理
function handleFeatureSwitch(tab, elements) {
    elements.featureTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const feature = tab.getAttribute('data-feature');
    elements.featureContainers.forEach(container => {
        container.classList.remove('active');
    });
    
    const targetContainer = document.querySelector(`.feature-container[data-feature="${feature}"]`);
    targetContainer?.classList.add('active');
}

// 初始化文件上传
function initializeFileUpload(elements, attachments) {
    elements.attachmentBtn.addEventListener('click', () => {
        elements.fileUpload.click();
    });

    elements.fileUpload.addEventListener('change', (e) => {
        try {
            const files = Array.from(e.target.files || []);
            files.forEach(file => {
                utils.validateAttachments(window.attachments.length);
                window.attachments.push(file);
                displayAttachment(file, elements.attachmentsList);
            });
            elements.fileUpload.value = '';
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

// 获取API Key的函数（需要实现）
async function getApiKey() {
    // TODO: 从安全的地方获取API Key
    // 可以是环境变量、后端API、加密存储等
    throw new Error('请配置API Key');
} 