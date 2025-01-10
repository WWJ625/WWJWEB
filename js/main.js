// 页面滚动和导航相关的功能
document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.fullpage-container');
    const sections = document.querySelectorAll('.section');
    const indicators = document.querySelectorAll('.indicator');
    const navLinks = document.querySelectorAll('.nav-link');
    const contentEditor = document.querySelector('.content-editor');
    const previewContent = document.querySelector('.preview-content');
    const emailEditorContainer = document.querySelector('.email-editor-container');
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
        // 只检查内容编辑器和预览内容区域
        const editorArea = contentEditor.contains(target) || target === contentEditor;
        const previewArea = previewContent.contains(target) || target === previewContent;
        const emailPreview = document.querySelector('.email-preview');
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
        // 清空输入框
        const contentEditor = document.querySelector('.content-editor');
        if (contentEditor) {
            contentEditor.innerHTML = '';
        }
        
        // 清空附件列表
        const attachmentsList = document.querySelector('.attachments-list');
        if (attachmentsList) {
            attachmentsList.innerHTML = '';
        }
        
        // 重置预览区域
        const previewContent = document.querySelector('.preview-content');
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

    // "了解更多"按钮点击事件
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
});

// 邮件编辑器相关功能
document.addEventListener('DOMContentLoaded', function() {
    // 获取必要的DOM元素
    const attachmentBtn = document.querySelector('.attachment-btn');
    const fileUpload = document.querySelector('#file-upload');
    const attachmentsList = document.querySelector('.attachments-list');
    const contentEditor = document.querySelector('.content-editor');
    const sendBtn = document.querySelector('.send-btn');
    const previewContent = document.querySelector('.preview-content');
    const copyBtn = document.querySelector('.copy-btn');

    // 存储附件列表
    let attachments = [];

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
            const response = await generateEmailResponse(content, attachments);
            displayResponse(response);
        } catch (error) {
            previewContent.innerHTML = `
                <div class="error-message">
                    生成回复时出错
                    <div class="error-detail">${error.message}</div>
                </div>
            `;
        }
    });

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
        const items = clipboardData.items;

        // 检查是否有图片
        let hasImage = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                // 获取图片文件
                const file = items[i].getAsFile();
                // 处理图片
                handlePastedImage(file);
                break;
            }
        }

        // 如果不是图片，则作为纯文本处理
        if (!hasImage) {
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
        }
    });

    // 处理粘贴的图片
    function handlePastedImage(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.margin = '10px 0';
            img.style.borderRadius = '4px';
            
            // 获取当前选区
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                // 移动光标到图片后面
                range.setStartAfter(img);
                range.setEndAfter(img);
                selection.removeAllRanges();
                selection.addRange(range);
                // 添加换行
                const br = document.createElement('br');
                img.parentNode.insertBefore(br, img.nextSibling);
            }
        };
        reader.readAsDataURL(file);
    }
}); 