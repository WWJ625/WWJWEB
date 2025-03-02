// 配置对象
const CONFIG = {
    MAX_ATTACHMENTS: 5,
    API_ENDPOINT: 'https://api.deepseek.com/v1/chat/completions',
    API_MODEL: 'deepseek-chat',
    API_KEY: 'sk-aa27b257a6f340acad96a6a733782c72',
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

// 全局变量定义
let sections;
let indicators;
let navLinks;
let initialLoadComplete = false;
let isNavigationClick = false; // 用于标记是否是导航点击触发的页面切换
// 防止某些滚动操作中断首页跳转

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
        
        // 也清空翻译功能内容 - 将此方法扩展为清空所有AI功能内容
        const translateEditor = document.querySelector('.feature-container[data-feature="translate"] .content-editor');
        if (translateEditor) {
            translateEditor.innerHTML = '';
            translateEditor.setAttribute('data-empty', 'true');
        }
        
        const translatePreview = document.querySelector('.feature-container[data-feature="translate"] .preview-content');
        if (translatePreview) {
            translatePreview.innerHTML = '<p class="placeholder-text">AI 将根据您的输入生成内容...</p>';
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
    // 初始化全局变量
    sections = document.querySelectorAll('.section');
    indicators = document.querySelectorAll('.indicator');
    navLinks = document.querySelectorAll('.nav-link');
    
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
        
        // 只有在section还没有active类时才添加
        // 这样可以避免中断已经在进行的动画
        if (!activeSection.classList.contains('active')) {
            // 更新section状态，添加动画效果
            sections.forEach(section => {
                section.classList.remove('active');
            });
            activeSection.classList.add('active');
        }
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
            
            // 更新导航状态，但不添加active类
            // 仅更新导航和指示器UI状态
            const sectionIndex = Array.from(sections).indexOf(section);
            
            // 更新指示器状态
            indicators.forEach(ind => ind.classList.remove('active'));
            if (indicators[sectionIndex]) {
                indicators[sectionIndex].classList.add('active');
            }

            // 更新导航链接状态
            navLinks.forEach(link => link.classList.remove('active'));
            const activeLinkHref = `#${section.id}`;
            const activeLink = document.querySelector(`.nav-link[href="${activeLinkHref}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
            
            // 根据是否是导航点击来决定动画效果
            if (window.isNavigationClick) {
                // 为内容元素设置不同的动画索引，使动画更加丰富
                const contentElements = section.querySelectorAll('.project-card, .music-card, .feature-tab, .feature-container');
                contentElements.forEach((el, index) => {
                    el.style.setProperty('--card-index', index);
                });
                
                // 动画前先重置所有元素样式
                let allAnimElements;
                
                if (section.id === 'ai-features') {
                    // AI功能页面时，只对非功能标签元素应用动画
                    allAnimElements = section.querySelectorAll('.project-card, .music-card, .hero-title, .hero-subtitle, .cta-button');
                } else {
                    // 对于其他页面，对所有元素应用动画
                    allAnimElements = section.querySelectorAll('.project-card, .music-card, .feature-tab, .feature-container, .hero-title, .hero-subtitle, .cta-button');
                }
                
                allAnimElements.forEach(el => {
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(30px) scale(0.95)';
                    el.style.filter = 'blur(10px)';
                });
                
                // 对于导航点击，使用延迟添加active类触发完整动画效果
                setTimeout(() => {
                    section.classList.add('active');
                    
                    // 添加进场动画的额外效果
                    const sectionContent = section.querySelector('.container') || section;
                    if (sectionContent) {
                        sectionContent.style.animation = 'fadeIn 0.5s ease forwards';
                    }
                    
                    // 确保动画完成后所有内容可见
                    setTimeout(() => {
                        // 对于AI功能页面，如果是导航点击，不自动显示功能容器
                        if (section.id === 'ai-features') {
                            const nonFeatureElements = section.querySelectorAll('.hero-title, .hero-subtitle, .cta-button');
                            nonFeatureElements.forEach(el => {
                                el.style.opacity = '1';
                                el.style.transform = 'translateY(0) scale(1)';
                                el.style.filter = 'blur(0)';
                            });
                        } else {
                            // 对于其他页面，显示所有内容
                            const allContentElements = section.querySelectorAll('.project-card, .music-card, .feature-tab, .feature-container, .hero-title, .hero-subtitle, .cta-button');
                            allContentElements.forEach(el => {
                                el.style.opacity = '1';
                                el.style.transform = 'translateY(0) scale(1)';
                                el.style.filter = 'blur(0)';
                            });
                        }
                    }, 1500); // 动画持续时间加上一点缓冲
                }, 300);
            } else {
                // 对于滚轮滚动，立即添加active类但不触发动画
                section.classList.add('active');
                
                // 对于滚轮滚动，立即显示所有内容元素，不等待动画
                const contentElements = section.querySelectorAll('.project-card, .music-card, .hero-title, .hero-subtitle, .cta-button');
                contentElements.forEach(el => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0) scale(1)';
                    el.style.filter = 'blur(0)';
                    // 移除可能导致动画的CSS类
                    el.style.animation = 'none';
                });
                
                // 处理AI功能页面的特殊情况
                if (section.id === 'ai-features') {
                    // 对于滚轮滚动，立即显示功能标签，不应用任何动画效果
                    const featureTabs = section.querySelectorAll('.feature-tab');
                    featureTabs.forEach(tab => {
                        tab.style.opacity = '1';
                        tab.style.transform = 'translateY(0) scale(1)';
                        tab.style.filter = 'blur(0)';
                        tab.style.animation = 'none';
                        tab.style.transition = 'none';
                    });
                    
                    // 保持功能容器的当前状态，不做处理
                } else {
                    // 对于非AI功能页面，可以设置其他元素的样式
                    const otherElements = section.querySelectorAll('.feature-tab');
                    otherElements.forEach(el => {
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0) scale(1)';
                        el.style.filter = 'blur(0)';
                    });
                }
                
                // 更新其他UI状态
                updateNavigationState(section);
            }
        }
    }

    // 导航点击事件处理
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const section = document.getElementById(targetId);
            
            // 标记这是一个导航点击事件，应该触发完整的动画效果
            window.isNavigationClick = true;
            
            // 如果是AI功能页面，强制调用重置函数
            if (targetId === 'ai-features') {
                resetAIFeaturesPage(true); // 传递true表示这是导航点击重置
            } else {
                // 对于其他页面，使用通用的重置
                resetSectionState(targetId);
            }
            
            // 滚动到目标section
            scrollToSection(section);
            
            // 重置标记
            setTimeout(() => {
                window.isNavigationClick = false;
                
                // 额外确保内容在动画结束后完全可见，但不影响AI功能容器的显示状态
                if (section) {
                    const allContentElements = section.querySelectorAll('.project-card, .music-card, .hero-title, .hero-subtitle, .cta-button');
                    // 注意这里移除了.feature-container，以免影响AI功能切换
                    allContentElements.forEach(el => {
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0) scale(1)';
                        el.style.filter = 'blur(0)';
                    });
                    
                    // 如果不是AI功能页面，才设置feature tabs的样式
                    if (section.id !== 'ai-features') {
                        const featureTabs = section.querySelectorAll('.feature-tab');
                        featureTabs.forEach(el => {
                            el.style.opacity = '1';
                            el.style.transform = 'translateY(0) scale(1)';
                            el.style.filter = 'blur(0)';
                        });
                    }
                }
            }, 1000);
        });
    });

    // 指示器点击事件处理
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            // 标记这是一个导航点击事件，应该触发完整的动画效果
            window.isNavigationClick = true;
            
            // 获取目标section的ID
            const targetSectionId = sections[index].id;
            
            // 如果是AI功能页面，强制调用重置函数
            if (targetSectionId === 'ai-features') {
                resetAIFeaturesPage(true); // 传递true表示这是导航点击重置
            } else {
                // 对于其他页面，使用通用的重置
                resetSectionState(targetSectionId);
            }
            
            // 滚动到目标section
            scrollToSection(sections[index]);
            
            // 重置标记
            setTimeout(() => {
                window.isNavigationClick = false;
                
                // 额外确保内容在动画结束后完全可见，但不影响AI功能容器的显示状态
                if (sections[index]) {
                    const allContentElements = sections[index].querySelectorAll('.project-card, .music-card, .hero-title, .hero-subtitle, .cta-button');
                    // 注意这里移除了.feature-container，以免影响AI功能切换
                    allContentElements.forEach(el => {
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0) scale(1)';
                        el.style.filter = 'blur(0)';
                    });
                    
                    // 如果不是AI功能页面，才设置feature tabs的样式
                    if (sections[index].id !== 'ai-features') {
                        const featureTabs = sections[index].querySelectorAll('.feature-tab');
                        featureTabs.forEach(el => {
                            el.style.opacity = '1';
                            el.style.transform = 'translateY(0) scale(1)';
                            el.style.filter = 'blur(0)';
                        });
                    }
                }
            }, 1000);
        });
    });

    // 滚动处理函数
    function scrollHandler() {
        // 如果初始加载尚未完成，则不触发滚动处理
        if (!initialLoadComplete) {
            return;
        }
        
        // 如果是由导航点击触发的，不在这里处理
        if (window.isNavigationClick) {
            return;
        }
        
        // 明确标记这不是导航点击
        window.isNavigationClick = false;
        
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
            // 仅当当前section不是活动section时才更新
            const isCurrentActive = currentSection.classList.contains('active');
            
            if (!isCurrentActive) {
                // 首先移除所有section的active类
                sections.forEach(section => {
                    section.classList.remove('active');
                });
                
                // 然后给当前section添加active类 - 但不播放动画效果
                currentSection.classList.add('active');
                
                // 立即显示所有内容元素，跳过动画效果（除了功能标签）
                const contentElements = currentSection.querySelectorAll('.project-card, .music-card, .hero-title, .hero-subtitle, .cta-button');
                contentElements.forEach(el => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0) scale(1)';
                    el.style.filter = 'blur(0)';
                    // 移除可能导致动画的CSS类
                    el.style.animation = 'none';
                });
                
                // 处理AI功能页面的特殊情况
                if (currentSection.id === 'ai-features') {
                    // 滚轮滚动时，保持AI功能页面的当前状态，不重置
                    
                    // 特别确保对功能标签不应用动画效果
                    const featureTabs = currentSection.querySelectorAll('.feature-tab');
                    featureTabs.forEach(tab => {
                        tab.style.opacity = '1';
                        tab.style.transform = 'translateY(0) scale(1)';
                        tab.style.filter = 'blur(0)';
                        tab.style.animation = 'none';
                        tab.style.transition = 'none';
                    });
                    
                    // 不自动显示AI功能容器，保持其当前状态
                    // 如果没有选中的功能标签，则显示引导提示
                    const hasActiveTab = Array.from(currentSection.querySelectorAll('.feature-tab')).some(tab => tab.classList.contains('active'));
                    if (!hasActiveTab && !document.querySelector('.feature-guide')) {
                        // 创建引导提示
                        const featureParent = currentSection.querySelector('.feature-containers');
                        if (featureParent) {
                            const guideElement = document.createElement('div');
                            guideElement.className = 'feature-guide';
                            guideElement.innerHTML = `
                                <div class="feature-guide-icon">👆</div>
                                <div class="feature-guide-text">请点击上方按钮选择您需要使用的智能助手功能</div>
                                <div class="feature-guide-hint">选择"邮件助手"或"翻译助手"开始使用</div>
                            `;
                            featureParent.appendChild(guideElement);
                        }
                    }
                } else {
                    // 对于非AI功能页面，可以设置其他元素的样式
                    const otherElements = currentSection.querySelectorAll('.feature-tab');
                    otherElements.forEach(el => {
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0) scale(1)';
                        el.style.filter = 'blur(0)';
                    });
                }
                
                // 更新其他UI状态
                updateNavigationState(currentSection);
            }
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

    // 全局导出这些函数，以便其他地方调用
    window.animation = {
        updateNavigationState,
        scrollToSection,
        scrollHandler
    };
}

// 初始化页面状态 - 移动到全局作用域
function initializePageState() {
    // 确保已经定义了必要的变量
    if (!sections || !indicators || !navLinks) {
        console.error('页面元素尚未初始化');
        return;
    }
    
    // 如果初始加载尚未完成，则退出
    if (!initialLoadComplete) {
        return;
    }
    
    // 检查当前是否已经有active的section
    const hasActiveSection = Array.from(sections).some(section => section.classList.contains('active'));
    
    // 如果已经有active section，不需要额外处理
    if (hasActiveSection) {
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
        
        // 立即更新导航状态的UI部分
        const sectionIndex = Array.from(sections).indexOf(targetSection);
        
        // 更新指示器状态
        indicators.forEach(ind => ind.classList.remove('active'));
        if (indicators[sectionIndex]) {
            indicators[sectionIndex].classList.add('active');
        }

        // 更新导航链接状态
        navLinks.forEach(link => link.classList.remove('active'));
        const activeLinkHref = `#${targetSection.id}`;
        const activeLink = document.querySelector(`.nav-link[href="${activeLinkHref}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // 添加active类触发动画
        targetSection.classList.add('active');
    }
}

// 初始化所有功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化动画系统 - 必须先执行这个，初始化全局变量
    initAnimations();
    
    // 初始化功能切换
    initFeatureSwitch();
    
    // 初始化 AI 功能
    initAIFeatures();
    
    // 不再在这里设置section的可见性，让CSS和动画机制来控制
});

// 在页面完全加载后（包括图片和样式），强制跳转到首页
window.onload = function() {
    // 标记初始加载完成
    initialLoadComplete = true;
    
    // 首先确保所有section可见性重置
    if (sections) {
        sections.forEach(section => {
            section.classList.remove('active');
            
            // 重置各个页面的初始状态
            resetSectionState(section.id);
            
            // 对于AI功能页面，特别确保其功能容器被隐藏
            if (section.id === 'ai-features') {
                const featureContainers = section.querySelectorAll('.feature-container');
                featureContainers.forEach(container => {
                    container.classList.remove('active');
                    // 使用强制内联样式和!important确保隐藏
                    container.setAttribute('style', 'opacity: 0 !important; transform: translateY(20px) scale(0.95) !important; filter: blur(5px) !important; display: none !important; animation: none !important;');
                });
                
                // 清空所有内容
                utils.clearAllContent();
                
                // 创建引导提示
                const featureParent = section.querySelector('.feature-containers');
                if (featureParent && !featureParent.querySelector('.feature-guide')) {
                    const guideElement = document.createElement('div');
                    guideElement.className = 'feature-guide';
                    guideElement.innerHTML = `
                        <div class="feature-guide-icon">👆</div>
                        <div class="feature-guide-text">请点击上方按钮选择您需要使用的智能助手功能</div>
                        <div class="feature-guide-hint">选择"邮件助手"或"翻译助手"开始使用</div>
                    `;
                    featureParent.appendChild(guideElement);
                }
            }
        });
        
        // 立即给首页添加active类，确保它立即可见
        if (sections[0]) {
            sections[0].classList.add('active');
        }
    }
    
    // 调用初始化页面状态函数
    initializePageState();
    
    // 强制滚动到页面顶部
    window.scrollTo(0, 0);
    
    // 更新URL为首页
    if (window.location.hash !== '#home') {
        history.replaceState(null, '', '#home');
    }
};

// 添加一个hashchange事件监听器，处理URL hash变化
window.addEventListener('hashchange', function() {
    // 获取当前hash（去掉#号）
    const targetId = window.location.hash.substring(1);
    if (targetId) {
        // 对于ai-features页面，设置isNavigationClick为true以确保重置
        if (targetId === 'ai-features') {
            window.isNavigationClick = true;
            
            // 直接调用重置函数，明确标记这是导航点击
            resetAIFeaturesPage(true);
            
            // 延迟一小段时间后重置标记
            setTimeout(() => {
                window.isNavigationClick = false;
            }, 100);
        } else {
            // 对于其他页面，使用通用的重置逻辑
            resetSectionState(targetId);
        }
        
        // 不需要在这里重复处理AI功能页面，因为上面已经处理过了
    }
});

// 添加一个防护措施，如果用户直接访问非首页URL，也会重定向到首页
if (window.location.hash && window.location.hash !== '#home') {
    window.location.hash = 'home';
}

// 功能切换初始化
function initFeatureSwitch() {
    const featureContainers = document.querySelectorAll('.feature-container');

    // 初始化时隐藏所有功能容器 - 使用更强制的方式隐藏
    featureContainers.forEach(container => {
        container.classList.remove('active');
        // 使用强制内联样式和!important确保隐藏
        container.setAttribute('style', 'opacity: 0 !important; transform: translateY(20px) scale(0.95) !important; filter: blur(5px) !important; display: none !important; animation: none !important;');
    });
    
    // 移除可能存在的旧引导提示
    const existingGuide = document.querySelector('.feature-guide');
    if (existingGuide) {
        existingGuide.remove();
    }
    
    // 创建新的引导提示
    const featureParent = document.querySelector('.feature-containers');
    if (featureParent) {
        const guideElement = document.createElement('div');
        guideElement.className = 'feature-guide';
        guideElement.innerHTML = `
            <div class="feature-guide-icon">👆</div>
            <div class="feature-guide-text">请点击上方按钮选择您需要使用的智能助手功能</div>
            <div class="feature-guide-hint">选择"邮件助手"或"翻译助手"开始使用</div>
        `;
        featureParent.appendChild(guideElement);
    }
    
    // 调用通用的功能标签绑定函数
    bindFeatureTabEvents();
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
    
    // 移除引导提示
    const guide = document.querySelector('.feature-guide');
    if (guide) {
        guide.remove();
    }
    
    // 更新内容容器 - 立即显示
    elements.featureContainers.forEach(container => {
        const feature = container.getAttribute('data-feature');
        
        // 首先移除所有样式
        container.removeAttribute('style');
        
        if (feature === selectedFeature) {
            // 先移除所有限制样式
            container.removeAttribute('style');
            
            // 确保容器可见
            container.style.display = 'grid'; // 邮件和翻译界面使用grid布局
            
            // 添加active类
            container.classList.add('active');
            
            // 设置为可见状态
            container.style.opacity = '1';
            container.style.transform = 'translateY(0) scale(1)';
            container.style.filter = 'blur(0)';
            container.style.animation = 'none';
            container.style.transition = 'opacity 0.15s ease';
            
            // 确保内容元素立即可见
            const contentElements = container.querySelectorAll('*');
            contentElements.forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0) scale(1)';
                el.style.filter = 'blur(0)';
                el.style.animationDelay = '0s';
            });
        } else {
            container.classList.remove('active');
            // 使用强制内联样式和!important确保隐藏
            container.setAttribute('style', 'opacity: 0 !important; transform: translateY(20px) scale(0.95) !important; filter: blur(5px) !important; display: none !important; animation: none !important;');
        }
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

    // 创建功能引导提示
    const createFeatureGuide = () => {
        // 先检查并移除可能存在的旧引导提示
        const existingGuide = document.querySelector('.feature-guide');
        if (existingGuide) {
            existingGuide.remove();
        }
        
        // 查找功能容器的父元素
        const featureParent = document.querySelector('.feature-containers');
        if (!featureParent) return;
        
        // 创建引导元素
        const guideElement = document.createElement('div');
        guideElement.className = 'feature-guide';
        guideElement.innerHTML = `
            <div class="feature-guide-icon">👆</div>
            <div class="feature-guide-text">请点击上方按钮选择您需要使用的智能助手功能</div>
            <div class="feature-guide-hint">选择"邮件助手"或"翻译助手"开始使用</div>
        `;
        
        // 添加到页面
        featureParent.appendChild(guideElement);
        
        // 当用户点击任何功能标签时移除引导
        const tabs = document.querySelectorAll('.feature-tab');
        tabs.forEach(tab => {
            // 使用事件委托或一次性事件监听器来避免重复绑定
            tab.addEventListener('click', function removeGuide() {
                // 检查引导元素是否仍然存在
                const guide = document.querySelector('.feature-guide');
                if (guide) {
                    guide.remove();
                }
                // 移除此事件监听器
                this.removeEventListener('click', removeGuide);
            });
        });
    };
    
    // 调用创建引导
    createFeatureGuide();

    // 存储附件列表
    window.attachments = [];

    // 功能切换 - 初始状态下不激活任何功能容器
    elements.featureTabs?.forEach(tab => {
        tab.classList.remove('active'); // 确保没有默认激活的标签
        tab.addEventListener('click', () => handleFeatureSwitch(tab, elements));
    });
    
    // 确保所有功能容器初始都是隐藏的
    elements.featureContainers?.forEach(container => {
        container.classList.remove('active');
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

// 页面状态重置函数
function resetSectionState(sectionId) {
    // 对于所有页面通用的重置逻辑
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // 重置该页面内的所有卡片和元素的动画状态
    const allElements = section.querySelectorAll('.project-card, .music-card, .hero-title, .hero-subtitle, .cta-button');
    allElements.forEach(el => {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.filter = '';
        el.style.animation = '';
        el.style.animationDelay = '';
    });
    
    // 针对特定页面的重置逻辑
    switch (sectionId) {
        case 'ai-features':
            // 重置智能体页面 - 已经在导航点击时直接调用resetAIFeaturesPage
            // 这里处理非导航点击的情况
            if (!window.isNavigationClick) {
                resetAIFeaturesPage(false); // 明确传递false表示非导航点击
            }
            break;
            
        case 'portfolio':
            // 重置作品集页面
            resetPortfolioPage();
            break;
            
        case 'music-share':
            // 重置音乐分享页面
            resetMusicPage();
            break;
            
        case 'home':
            // 重置首页
            resetHomePage();
            break;
            
        // 可以添加更多页面的重置逻辑
    }
}

// 重置智能体页面的函数
function resetAIFeaturesPage(isNavigationClick = false) {
    // 如果是导航点击，则完全重置页面状态
    if (isNavigationClick) {
        // 重置功能标签状态
        const featureTabs = document.querySelectorAll('.feature-tab');
        featureTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        // 隐藏所有功能容器 - 使用强制样式
        const featureContainers = document.querySelectorAll('.feature-container');
        featureContainers.forEach(container => {
            container.classList.remove('active');
            // 使用强制内联样式和!important确保隐藏
            container.setAttribute('style', 'opacity: 0 !important; transform: translateY(20px) scale(0.95) !important; filter: blur(5px) !important; display: none !important; animation: none !important;');
        });
        
        // 使用已有的清空内容函数
        utils.clearAllContent();
        
        // 移除旧引导元素
        const existingGuide = document.querySelector('.feature-guide');
        if (existingGuide) {
            existingGuide.remove();
        }
        
        // 延迟很短时间后创建新的引导提示，确保DOM已经更新
        setTimeout(() => {
            // 创建新的引导提示
            const featureParent = document.querySelector('.feature-containers');
            if (featureParent) {
                const guideElement = document.createElement('div');
                guideElement.className = 'feature-guide';
                guideElement.style.opacity = '0'; // 初始设为透明
                guideElement.innerHTML = `
                    <div class="feature-guide-icon">👆</div>
                    <div class="feature-guide-text">请点击上方按钮选择您需要使用的智能助手功能</div>
                    <div class="feature-guide-hint">选择"邮件助手"或"翻译助手"开始使用</div>
                `;
                
                // 添加到页面
                featureParent.appendChild(guideElement);
                
                // 延迟显示引导提示，确保它在页面转换后显示
                setTimeout(() => {
                    guideElement.style.opacity = '1';
                    guideElement.style.transition = 'opacity 0.3s ease';
                }, 300);
            }
            
            // 重新绑定功能标签的点击事件
            bindFeatureTabEvents();
        }, 100);
    } else {
        // 如果不是导航点击，保持当前状态
        // 只在没有激活标签时添加引导提示
        const hasActiveTab = document.querySelector('.feature-tab.active');
        if (!hasActiveTab) {
            // 确保只添加一个引导提示
            const existingGuide = document.querySelector('.feature-guide');
            if (!existingGuide) {
                const featureParent = document.querySelector('.feature-containers');
                if (featureParent) {
                    const guideElement = document.createElement('div');
                    guideElement.className = 'feature-guide';
                    // 立即显示，不需要渐变效果
                    guideElement.innerHTML = `
                        <div class="feature-guide-icon">👆</div>
                        <div class="feature-guide-text">请点击上方按钮选择您需要使用的智能助手功能</div>
                        <div class="feature-guide-hint">选择"邮件助手"或"翻译助手"开始使用</div>
                    `;
                    featureParent.appendChild(guideElement);
                }
            }
        }
    }
}

// 重置作品集页面的函数
function resetPortfolioPage() {
    // 重置所有项目卡片的状态
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach((card, index) => {
        card.style.setProperty('--card-index', index); // 重置卡片索引
        card.classList.remove('hovered'); // 移除可能的悬停状态
    });
}

// 重置音乐分享页面的函数
function resetMusicPage() {
    // 重置所有音乐卡片的状态
    const musicCards = document.querySelectorAll('.music-card');
    musicCards.forEach((card, index) => {
        card.style.setProperty('--card-index', index); // 重置卡片索引
        card.classList.remove('hovered'); // 移除可能的悬停状态
    });
    
    // 停止可能正在播放的音乐
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
    });
    
    // 重置播放按钮状态
    const playButtons = document.querySelectorAll('.play-button');
    playButtons.forEach(button => {
        button.classList.remove('playing');
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>';
    });
}

// 重置首页的函数
function resetHomePage() {
    // 重置英雄区域中的元素
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const ctaButton = document.querySelector('.cta-button');
    
    if (heroTitle) heroTitle.style.animation = '';
    if (heroSubtitle) heroSubtitle.style.animation = '';
    if (ctaButton) ctaButton.style.animation = '';
    
    // 重置激光和粒子动画
    const lasers = document.querySelectorAll('.laser');
    const particles = document.querySelectorAll('.particle');
    const glows = document.querySelectorAll('.glow');
    
    lasers.forEach(laser => {
        laser.style.animation = '';
        // 重启激光动画
        void laser.offsetWidth; // 触发重排，重置动画
        laser.style.animation = 'laserMove 8s linear infinite';
    });
    
    particles.forEach(particle => {
        particle.style.animation = '';
        // 重启粒子动画
        void particle.offsetWidth;
        particle.style.animation = 'particleFloat 15s linear infinite';
    });
    
    glows.forEach(glow => {
        glow.style.animation = '';
        // 重启发光效果动画
        void glow.offsetWidth;
        glow.style.animation = 'glowPulse 8s ease-in-out infinite';
    });
}

// 绑定功能标签点击事件的函数（避免重复代码）
function bindFeatureTabEvents() {
    const tabs = document.querySelectorAll('.feature-tab');
    const containers = document.querySelectorAll('.feature-container');
    
    tabs.forEach(tab => {
        // 移除可能存在的所有点击事件（通过克隆节点）
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        // 添加新的点击事件
        newTab.addEventListener('click', function() {
            // 移除引导提示
            const guide = document.querySelector('.feature-guide');
            if (guide) {
                guide.remove();
            }
            
            // 获取功能标识
            const feature = this.dataset.feature;
            
            // 更新标签状态
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 更新容器显示状态 - 确保立即显示选中的容器
            containers.forEach(container => {
                // 首先重置所有容器的样式 - 移除强制样式
                container.removeAttribute('style');
                container.classList.remove('active');
                
                // 立即隐藏非激活容器
                if (container.dataset.feature !== feature) {
                    // 使用强制内联样式和!important确保隐藏
                    container.setAttribute('style', 'opacity: 0 !important; transform: translateY(20px) scale(0.95) !important; filter: blur(5px) !important; display: none !important; animation: none !important;');
                }
                
                // 立即显示激活的容器
                if (container.dataset.feature === feature) {
                    // 完全移除所有限制样式
                    container.removeAttribute('style');
                    
                    // 先添加active类
                    container.classList.add('active');
                    
                    // 设置为可见状态
                    container.style.opacity = '1';
                    container.style.transform = 'translateY(0) scale(1)';
                    container.style.filter = 'blur(0)';
                    container.style.animation = 'none';
                    container.style.display = 'grid'; // 确保使用正确的显示方式
                    
                    // 确保内容元素立即可见
                    const contentElements = container.querySelectorAll('*');
                    contentElements.forEach(el => {
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0) scale(1)';
                        el.style.filter = 'blur(0)';
                        el.style.animationDelay = '0s';
                    });
                }
            });
        });
    });
} 