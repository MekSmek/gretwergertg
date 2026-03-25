const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — разрешаем всё
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100mb' }));

const NIM_API_KEY = process.env.NVIDIA_API_KEY;

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
});

// Корневой эндпоинт
app.get('/', (req, res) => {
    res.json({ 
        message: 'NVIDIA NIM Proxy is running', 
        endpoints: ['GET /health', 'POST /v1/chat/completions']
    });
});

// Основной эндпоинт
app.post('/v1/chat/completions', async (req, res) => {
    // Явно указываем, что ответ будет JSON
    res.setHeader('Content-Type', 'application/json');
    
    console.log('📨 Получен запрос');
    console.log('  Модель:', req.body.model);
    console.log('  Сообщений:', req.body.messages?.length);
    
    // Проверяем ключ
    if (!NIM_API_KEY) {
        console.error('❌ Нет API ключа');
        return res.status(500).json({ 
            error: {
                message: 'NVIDIA_API_KEY not configured',
                type: 'configuration_error',
                code: 500
            }
        });
    }
    
    try {
        // Отправляем запрос в NVIDIA
        const response = await axios.post(
            'https://integrate.api.nvidia.com/v1/chat/completions',
            req.body,
            {
                headers: {
                    'Authorization': `Bearer ${NIM_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );
        
        console.log('✅ Ответ получен от NVIDIA');
        
        // Отправляем JSON-ответ
        return res.status(200).json(response.data);
        
    } catch (error) {
        console.error('❌ Ошибка прокси:');
        console.error('  Статус:', error.response?.status);
        console.error('  Сообщение:', error.response?.data?.error?.message || error.message);
        
        // Возвращаем ошибку в формате OpenAI (JSON)
        return res.status(error.response?.status || 500).json({
            error: {
                message: error.response?.data?.error?.message || error.message,
                type: 'proxy_error',
                code: error.response?.status || 500
            }
        });
    }
});

// Заглушка для неправильных методов
app.get('/v1/chat/completions', (req, res) => {
    res.status(405).json({ 
        error: {
            message: 'Method not allowed. Use POST.',
            type: 'invalid_request_error',
            code: 405
        }
    });
});

// Запуск
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Proxy running on port ${PORT}`);
    console.log(`📍 Health: /health`);
    console.log(`📍 POST /v1/chat/completions`);
});
