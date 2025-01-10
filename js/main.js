// 页面滚动和导航功能
function initializeNavigation() {
    const container = document.querySelector('.fullpage-container');
    const sections = document.querySelectorAll('.section');
    const indicators = document.querySelectorAll('.indicator');
    const navLinks = document.querySelectorAll('.nav-link');
    let currentSection = 0;
    let isAnimating = false;

    // 更新活动状态
    function updateActiveState(index) {
        // 移除所有导航链接的活动状态
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        // 找到对应索引的导航链接并添加活动状态
        const activeLink = document.querySelector(`.nav-link[data-index="${index}"]`);
        if (activeLink && index !== 0) {
            activeLink.classList.add('active');
        }
        
        // 更新指示器状态
        indicators.forEach(indicator => indicator.classList.remove('active'));
        indicators[index].classList.add('active');
    }

    // 切换到指定页面
    function goToSection(index) {
        if (isAnimating || index === currentSection) return;
        if (index < 0 || index >= sections.length) return;
        
        isAnimating = true;
        const translateY = -100 * index;
        container.style.transform = `translateY(${translateY}vh)`;
        currentSection = index;
        updateActiveState(index);

        setTimeout(() => {
            isAnimating = false;
        }, 1000);
    }

    // 检查是否在可滚动区域内
    function isInScrollableArea(target) {
        const contentEditor = document.querySelector('.content-editor');
        const previewContent = document.querySelector('.preview-content');
        const emailPreview = document.querySelector('.email-preview');
        
        // 只检查内容编辑器和预览内容区域
        const editorArea = contentEditor && (contentEditor.contains(target) || target === contentEditor);
        const previewArea = previewContent && (previewContent.contains(target) || target === previewContent);
        const emailPreviewArea = emailPreview && (emailPreview.contains(target) || target === emailPreview);
        
        return editorArea || previewArea || emailPreviewArea;
    }

    // 监听鼠标滚轮
    function handleWheel(e) {
        if (isAnimating) return;

        // 检查是否在可滚动区域内
        if (isInScrollableArea(e.target)) {
            // 在可滚动区域内，阻止页面切换
            e.stopPropagation();
            return;
        }

        // 在其他区域正常切换页面
        if (e.deltaY > 0 && currentSection < sections.length - 1) {
            goToSection(currentSection + 1);
        } else if (e.deltaY < 0 && currentSection > 0) {
            goToSection(currentSection - 1);
        }
    }

    // 监听触摸事件
    let touchStartY = 0;
    container.addEventListener('touchstart', e => {
        // 如果触摸开始于可滚动区域，不处理页面切换
        if (isInScrollableArea(e.target)) {
            return;
        }
        touchStartY = e.touches[0].clientY;
    });

    container.addEventListener('touchmove', e => {
        // 如果触摸移动在可滚动区域内，不处理页面切换
        if (isAnimating || isInScrollableArea(e.target)) {
            return;
        }
        
        const touchEndY = e.touches[0].clientY;
        const diff = touchStartY - touchEndY;

        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentSection < sections.length - 1) {
                goToSection(currentSection + 1);
            } else if (diff < 0 && currentSection > 0) {
                goToSection(currentSection - 1);
            }
            touchStartY = touchEndY;
        }
    });

    // 绑定事件监听器
    window.addEventListener('wheel', handleWheel);
    
    // 导航菜单点击事件
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const index = parseInt(link.getAttribute('data-index'));
            goToSection(index);
        });
    });

    // 添加 logo 点击事件
    document.querySelector('.logo-link').addEventListener('click', e => {
        e.preventDefault();
        // 如果点击的是首页，清空邮件编辑器的内容
        const contentEditor = document.querySelector('.content-editor');
        const attachmentsList = document.querySelector('.attachments-list');
        const previewContent = document.querySelector('.preview-content');

        if (contentEditor) {
            contentEditor.innerHTML = '';
        }
        
        if (attachmentsList) {
            attachmentsList.innerHTML = '';
        }
        
        if (previewContent) {
            previewContent.innerHTML = '<p class="placeholder-text">AI 将根据您的输入生成邮件内容...</p>';
        }
        
        goToSection(0);
    });

    // 页面指示器点击事件
    indicators.forEach(indicator => {
        indicator.addEventListener('click', () => {
            const index = parseInt(indicator.getAttribute('data-index'));
            goToSection(index);
        });
    });

    // "开始使用"按钮点击事件
    document.querySelector('.next-section').addEventListener('click', e => {
        e.preventDefault();
        goToSection(1);
    });

    // 添加键盘导航支持
    document.addEventListener('keydown', (e) => {
        if (isAnimating) return;
        
        // 检查是否在可编辑区域
        const activeElement = document.activeElement;
        if (activeElement.isContentEditable || 
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
            case 'PageDown':
                if (currentSection < sections.length - 1) {
                    e.preventDefault();
                    goToSection(currentSection + 1);
                }
                break;
            case 'ArrowUp':
            case 'PageUp':
                if (currentSection > 0) {
                    e.preventDefault();
                    goToSection(currentSection - 1);
                }
                break;
            case 'Home':
                e.preventDefault();
                goToSection(0);
                break;
            case 'End':
                e.preventDefault();
                goToSection(sections.length - 1);
                break;
        }
    });

    return { goToSection };
}

// 等待 DOM 和 EmailAPI 完全加载
document.addEventListener('DOMContentLoaded', () => {
    // 初始化导航功能
    const navigation = initializeNavigation();

    // 检查 EmailAPI 是否已加载
    if (!window.EmailAPI) {
        console.error('EmailAPI 未加载');
        return;
    }

    // 获取 DOM 元素
    const contentEditor = document.querySelector('.content-editor');
    const sendBtn = document.querySelector('.send-btn');
    const previewContent = document.querySelector('.preview-content');
    const copyBtn = document.querySelector('.copy-btn');
    const attachmentBtn = document.querySelector('.attachment-btn');
    const fileUpload = document.querySelector('#file-upload');
    const attachmentsList = document.querySelector('.attachments-list');
    
    // 存储附件列表
    let attachments = [];

    // 生成回复按钮点击事件
    sendBtn.addEventListener('click', async () => {
        const content = contentEditor.innerText.trim();
        if (!content) {
            alert('请输入邮件内容');
            return;
        }

        // 显示加载状态
        previewContent.innerHTML = '<div class="loading">正在生成回复...</div>';

        try {
            const response = await window.EmailAPI.generateEmailResponse(content, attachments);
            window.EmailAPI.displayResponse(response);
        } catch (error) {
            previewContent.innerHTML = `
                <div class="error-message">
                    生成回复时出错
                    <div class="error-detail">${error.message}</div>
                </div>
            `;
        }
    });

    // 附件按钮点击事件
    attachmentBtn.addEventListener('click', () => {
        fileUpload.click();
    });

    // 文件上传处理
    fileUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (attachments.length >= 5) {
                alert('最多只能添加5个附件');
                return;
            }
            attachments.push(file);
            displayAttachment(file);
        });
        fileUpload.value = ''; // 清空input，允许重复选择相同文件
    });

    // 显示附件
    function displayAttachment(file) {
        const div = document.createElement('div');
        div.className = 'attachment-item';
        div.innerHTML = `
            <span class="file-name">${file.name}</span>
            <button class="remove-file" data-name="${file.name}">×</button>
        `;
        attachmentsList.appendChild(div);

        // 删除附件事件
        div.querySelector('.remove-file').addEventListener('click', function() {
            const fileName = this.getAttribute('data-name');
            attachments = attachments.filter(f => f.name !== fileName);
            div.remove();
        });
    }

    // 复制按钮功能
    copyBtn.addEventListener('click', () => {
        const emailBody = previewContent.querySelector('.email-body');
        if (!emailBody) {
            alert('没有可复制的内容');
            return;
        }

        // 创建临时文本区域
        const textarea = document.createElement('textarea');
        textarea.value = emailBody.innerText;
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            alert('内容已复制到剪贴板');
        } catch (err) {
            alert('复制失败，请手动复制');
        }
        
        document.body.removeChild(textarea);
    });

    // 内容编辑器的 placeholder 处理
    contentEditor.addEventListener('focus', function() {
        if (this.innerHTML === '') {
            this.innerHTML = '';
        }
    });

    contentEditor.addEventListener('blur', function() {
        if (this.innerHTML === '') {
            this.innerHTML = '';
        }
    });

    // 添加粘贴事件处理
    contentEditor.addEventListener('paste', function(e) {
        // 阻止默认粘贴行为
        e.preventDefault();
        
        const clipboardData = e.clipboardData || window.clipboardData;
        const text = clipboardData.getData('text/plain');
        
        // 使用 document.execCommand 插入纯文本
        if (document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, text);
        } else {
            // 如果 insertText 命令不支持，则使用替代方法
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    });
}); 