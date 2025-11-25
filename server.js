import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Функция для чтения JSON файла
function readJsonFile(filename) {
    try {
        const data = fs.readFileSync(path.join(__dirname, filename), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Ошибка чтения файла ${filename}:`, error);
        return null;
    }
}

// Маршруты API

// Главная страница
app.get('/', (req, res) => {
    res.json({
        message: 'API парсера недвижимости',
        endpoints: {
            '/api/buildings': 'Все ЖК с квартирами',
            '/api/apartments': 'Все квартиры',
            '/api/buildings/:id': 'Конкретный ЖК',
            '/api/stats': 'Статистика',
            '/api/search': 'Поиск квартир'
        }
    });
});

// Все ЖК с квартирами (группированные данные)
app.get('/api/buildings', (req, res) => {
    const data = readJsonFile('./objects/apartments-grouped.json');
    if (data) {
        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Данные не найдены'
        });
    }
});

// Все квартиры (плоский список)
app.get('/api/apartments', (req, res) => {
    const data = readJsonFile('./objects/apartments-all.json');
    if (data) {
        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Данные не найдены'
        });
    }
});

// Конкретный ЖК по ID
app.get('/api/buildings/:id', (req, res) => {
    const buildingId = req.params.id;
    const data = readJsonFile('./objects/apartments-grouped.json');

    if (data) {
        const building = data.find(b => b.building_info.objectId === buildingId);
        if (building) {
            res.json({
                success: true,
                data: building
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'ЖК не найден'
            });
        }
    } else {
        res.status(500).json({
            success: false,
            error: 'Данные не найдены'
        });
    }
});

// Статистика
app.get('/api/stats', (req, res) => {
    const groupedData = readJsonFile('./objects/apartments-grouped.json');
    const allData = readJsonFile('./objects/apartments-all.json');

    if (groupedData && allData) {
        const totalBuildings = groupedData.length;
        const totalApartments = allData.length;
        const successfulApartments = allData.filter(apt => !apt.error && apt.apart_data).length;

        res.json({
            success: true,
            stats: {
                total_buildings: totalBuildings,
                total_apartments: totalApartments,
                successful_apartments: successfulApartments,
                failed_apartments: totalApartments - successfulApartments,
                success_rate: ((successfulApartments / totalApartments) * 100).toFixed(2) + '%'
            },
            last_updated: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Данные не найдены'
        });
    }
});

// Поиск квартир
app.get('/api/search', (req, res) => {
    const { q, min_price, max_price, rooms } = req.query;
    const allData = readJsonFile('./objects/apartments-all.json');

    if (!allData) {
        return res.status(500).json({ error: 'Данные не найдены' });
    }

    let results = allData.filter(apt => !apt.error && apt.apart_data);

    // Поиск по тексту
    if (q) {
        results = results.filter(apt =>
            apt.apart_data.title?.toLowerCase().includes(q.toLowerCase()) ||
            apt.apart_data.location?.toLowerCase().includes(q.toLowerCase())
        );
    }

    // Фильтр по цене
    if (min_price) {
        results = results.filter(apt => {
            const price = parseInt(apt.apart_data.price?.replace(/\D/g, ''));
            return price >= parseInt(min_price);
        });
    }

    if (max_price) {
        results = results.filter(apt => {
            const price = parseInt(apt.apart_data.price?.replace(/\D/g, ''));
            return price <= parseInt(max_price);
        });
    }

    // Фильтр по комнатам
    if (rooms) {
        results = results.filter(apt => {
            const roomsText = apt.apart_data.rooms?.toLowerCase();
            return roomsText?.includes(rooms.toLowerCase());
        });
    }

    res.json({
        success: true,
        count: results.length,
        data: results
    });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API сервер запущен: http://localhost:${PORT}`);
    console.log(`📊 Доступные endpoints:`);
    console.log(`   http://localhost:${PORT}/api/buildings`);
    console.log(`   http://localhost:${PORT}/api/apartments`);
    console.log(`   http://localhost:${PORT}/api/stats`);
    console.log(`   http://localhost:${PORT}/api/search?q=москва`);
});