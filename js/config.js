 // 配置文件
const CONFIG = {
    API_ENDPOINT: 'https://api.deepseek.com/v1/chat/completions',
    API_MODEL: 'deepseek-chat',
    MAX_ATTACHMENTS: 5,
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    RATE_LIMIT: 5, // 每分钟最多5次请求
    REQUEST_TIMEOUT: 10000, // 10秒超时
    CACHE_VERSION: 'v1.0.0'
};

// 从环境变量获取API Key
const API_KEY = process.env.API_KEY || 'your-api-key-here';

export { CONFIG, API_KEY };