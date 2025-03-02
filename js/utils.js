 // 历史记录功能
const history = {
    save: function(content, type = 'email') {
        const historyData = JSON.parse(localStorage.getItem('history') || [];
        historyData.push({
            type,
            content,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('history', JSON.stringify(historyData.slice(-50))); // 只保留最近50条
    },
    load: function(type = null) {
        const historyData = JSON.parse(localStorage.getItem('history') || []);
        return type ? historyData.filter(item => item.type === type) : historyData;
    },
    clear: function() {
        localStorage.removeItem('history');
    }
};

export { history };