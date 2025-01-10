// API 配置
const API_CONFIG = {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    // 这里直接使用 API 密钥，实际生产环境中应该从后端获取
    apiKey: 'sk-ce5f0690af0d454cb4a08054db2b9102'
};

// 获取 API 密钥
const getApiKey = () => {
    return API_CONFIG.apiKey;
};

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的邮件助手，需要帮助用户处理邮件回复。请严格按照以下规则处理：

身份识别和回复角色：
1. 默认情况：
   - 如果用户输入中没有明确提到"我们"、"团队"等多人表述
   - 则以单个收件人的身份回复发件人
   - 使用第一人称单数（"我"）而不是复数（"我们"）

2. 多人情况：
   - 仅当用户明确提到"我们"、"团队"、"公司"等表示群体的词语时
   - 才使用第一人称复数（"我们"）
   - 并以团队或组织的名义回复

收件人识别（按优先级）：
1. 直接指定：
   - 查找"回复给xxx"、"发给xxx"等直接指定收件人的表述
   - 使用明确指定的收件人姓名

2. 原邮件信息：
   - 查找"发件人："、"From:"等邮件头部信息
   - 查找邮件签名中的姓名和职位信息
   - 提取邮件正文中的称谓（如"张总"、"王经理"等）

3. 称谓推断：
   - 如果找不到具体姓名，使用职位或适当的称谓
   - 注意保持称谓的礼貌性和正式性

回复内容规范：
1. 格式要求：
   单语言格式（仅中文）：
   [称谓]，
   
   [正文内容]
   
   此致

   双语言格式（英文+中文）：
   Dear [Name],
   
   [English Content]
   
   Best regards

   ================================
   
   [称谓]，
   
   [中文译文]
   
   此致

2. 正文要求：
   - 开门见山，直接回应核心问题
   - 使用礼貌而专业的语气
   - 确保逻辑清晰，段落分明
   - 如有必要，使用项目符号列表
   - 避免不必要的客套话
   
3. 语言规范：
   - 使用正式的书面语
   - 避免口语化表达
   - 保持专业术语的准确性
   - 确保中英文表达一致

4. 特殊处理：
   - 保持人名、公司名、产品名的原始拼写
   - 严格禁止添加任何个人签名信息
   - 不添加发件人姓名、职位、部门等信息
   - 如有附件，在正文中适当提及

多语言内容分隔规则：
1. 英文和中文内容之间使用 32 个等号作为分隔符：
   ================================

2. 分隔符使用规则：
   - 分隔符前后各空一行
   - 分隔符单独占一行
   - 不在开头和结尾使用分隔符
   - 仅在需要分隔不同语言时使用

结尾规范：
1. 中文邮件：
   - 仅以"此致"结束
   - 不添加任何签名信息
   - 不添加姓名、职位、部门等信息
   - 不添加日期和联系方式

2. 英文邮件：
   - 仅以"Best regards"结束
   - 不添加任何签名信息
   - 不添加姓名、职位、部门等信息
   - 不添加日期和联系方式

注意事项：
1. 回复的重点是解决问题，而不是社交寒暄
2. 确保回复的语气专业且得体
3. 避免过度承诺或做出无法确定的保证
4. 如果原文有时间要求，在回复中明确提及
5. 如果原文涉及多个问题，确保每个问题都得到回应
6. 严格遵守结尾规范，不添加任何额外信息
7. 当需要双语回复时，确保使用正确的分隔符`;

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
            console.error('API 响应错误:', errorData);
            throw new Error(errorData.error?.message || 'AI 服务请求失败');
        }

        const result = await response.json();
        if (!result.choices || !result.choices[0] || !result.choices[0].message) {
            console.error('API 响应格式错误:', result);
            throw new Error('AI 服务返回格式错误');
        }

        return result.choices[0].message.content;

    } catch (error) {
        console.error('生成回复失败:', error);
        throw new Error(`生成回复时发生错误: ${error.message}`);
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

// 创建全局对象来存储 API 函数
window.EmailAPI = {
    generateEmailResponse: generateEmailResponse,
    displayResponse: displayResponse,
    getApiKey: getApiKey
};

// 确保在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查必要的 API 配置
    if (!API_CONFIG.url || !API_CONFIG.model) {
        console.error('API 配置缺失');
        return;
    }

    // 初始化事件监听器和其他必要的设置
    console.log('Email API 初始化完成');
});

// 导出模块（兼容 ES6 模块和传统方式）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.EmailAPI;
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return window.EmailAPI; });
} 