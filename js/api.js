// API 配置
const API_CONFIG = {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
};

// 从环境变量获取 API 密钥
const getApiKey = () => {
    // 这里应该从环境变量或安全的配置中获取 API 密钥
    // 在实际部署时，这个值应该从后端获取，而不是硬编码在前端
    return process.env.DEEPSEEK_API_KEY || '';
};

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的邮件助手，需要帮助用户处理邮件回复。请严格按照以下规则处理：

邮件收件人识别（按优先级）：
1. 用户明确指定：
   - 首先检查用户输入中是否明确指定了收件人
   - 如果用户明确提到"回复给xxx"或类似表述，则使用该人作为收件人

2. 邮件签名信息：
   - 如果用户没有明确指定，查找原始邮件中的签名信息
   - 识别邮件底部的发件人姓名、职位等信息

3. 邮件头部信息：
   - 如果没有签名信息，查看邮件头部的发件人(From)字段
   - 使用发件人字段中的姓名作为收件人

4. 其他识别信息：
   - 如果以上都没有，查找邮件正文中的称谓、问候语等
   - 提取可能是发件人的名字或称谓

邮件内容理解：
1. 上下文分析：
   - 理解原始邮件的主要问题或请求
   - 识别所有相关方及其关系
   - 确保回复准确对应原始问题

2. 特殊名称处理：
   - 保持所有人名的原始拼写
   - 保持公司名称、产品名称的原始拼写
   - 保持专业术语的原始表达
   - 确保中英文一致性

回复格式规范：
1. 英文格式：
   - 开头：Dear [收件人],
   - 正文：简洁明了的回应
   - 结尾：仅使用 "Best regards," 作为结束语

2. 中文格式：
   - 开头：[收件人]，
   - 正文：简洁明了的回应
   - 结尾：仅使用 "此致," 作为结束语

3. 双语处理：
   [英文回复]
   
   =========
   中文译文：
   
   [中文回复]

注意事项：
1. 确保收件人准确性
2. 保持回复简洁明了
3. 不添加未提及的信息
4. 不添加签名、职位、公司等信息
5. 结尾只用简单的客套语，不要添加"[你的名字]"、"[你的职位]"等占位符`;

// 生成邮件回复
async function generateEmailResponse(content, attachments = []) {
    try {
        // 检查是否要求英文回复
        const isEnglishRequired = content.toLowerCase().includes('用英文') || 
                                content.toLowerCase().includes('用英语') || 
                                content.toLowerCase().includes('in english');
        
        // 移除"用英文回复"等指令
        let cleanContent = content;
        if (isEnglishRequired) {
            cleanContent = content.replace(/用英文回复|用英文|用英语|in english/gi, '').trim();
        }

        // 构建用户提示词
        const userPrompt = `请帮我回复以下邮件内容：${cleanContent}
${isEnglishRequired ? '请用英文回复，并在回复后附上中文译文。' : '请用中文回复。'}
${attachments.length > 0 ? `附件列表：\n${attachments.map(file => `- ${file.name}`).join('\n')}` : ''}`;

        // 调用 API
        const response = await fetch(API_CONFIG.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getApiKey()}`
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000,
                top_p: 0.95,
                frequency_penalty: 0,
                presence_penalty: 0
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

// 显示回复内容
function displayResponse(response) {
    const previewContent = document.querySelector('.preview-content');
    // 添加邮件主题
    const subject = '邮件回复';
    
    previewContent.innerHTML = `
        <div class="email-subject">${subject}</div>
        <div class="email-body">${response.replace(/\n/g, '<br>')}</div>
    `;
}

// 导出函数供其他模块使用
window.generateEmailResponse = generateEmailResponse;
window.displayResponse = displayResponse; 