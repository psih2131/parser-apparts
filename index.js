import puppeteer from 'puppeteer';
import fs from 'fs';
import { scrollRandom } from './components/scrollPageDown.js';
import { scrollToBlock } from './components/scrollToCurrentAppartBlock.js';

let devMode = true;
const domainUrl = 'https://avaho.ru';

// Чтение прокси из JSON файла
let proxies = [];
try {
    const proxyData = fs.readFileSync('./json/proxy.json', 'utf8');
    proxies = JSON.parse(proxyData);
    console.log(`Загружено прокси: ${proxies.length}`);
} catch (error) {
    console.error('Ошибка загрузки proxy.json:', error);
    proxies = [];
}

//рандомный прокси
function getRandomProxy() {
    if (proxies.length === 0) {
        console.log('Нет доступных прокси, работа без прокси');
        return null;
    }

    const raw = proxies[Math.floor(Math.random() * proxies.length)];
    console.log('Выбран прокси:', raw);

    // Разбираем строку прокси
    const [host, port, username, password] = raw.split(":");

    return {
        host,
        port,
        username,
        password,
        proxyUrl: `http://${host}:${port}`
    };
}

// Настройки браузера с прокси
async function createBrowserWithProxy() {
    const proxy = getRandomProxy();

    const browserOptions = {
        headless: false,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    };

    // Добавляем прокси если есть
    if (proxy) {
        browserOptions.args.push(`--proxy-server=${proxy.proxyUrl}`);
    }

    const browser = await puppeteer.launch(browserOptions);

    // Сохраняем данные прокси в браузер для использования в страницах
    browser.proxyData = proxy;

    return browser;
}

// Создание страницы с авторизацией прокси
async function createPageWithProxyAuth(browser) {
    const page = await browser.newPage();

    // Авторизация в прокси если есть
    if (browser.proxyData && browser.proxyData.username) {
        await page.authenticate({
            username: browser.proxyData.username,
            password: browser.proxyData.password
        });
    }

    // Устанавливаем User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    return page;
}

// первый набор объектов
const objects1 = [
    'https://avaho.ru/novostroyka/moskva/zao/ramenki/hide/9755946/',
    'https://avaho.ru/novostroyka/moskva/cao/hamovniki/xxii/15312614/'
];

// второй набор объектов
const objects2 = [
    'https://avaho.ru/novostroyka/moskva/zao/dorogomilovo/doro-mille/15219864/',
];

// третий набор объектов
const objects3 = [
    'https://avaho.ru/novostroyka/moskva/cao/hamovniki/savvinskaya-17/13733097/'
];

// пауза
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// функция для получения ссылок апартаментов
async function getApartmentLinks(page) {
    const apartLinks = await page.$$eval('.ns-list__row', rows =>
        rows
            .map(row => {
                const linkEl = row.querySelector('.ns-list__col-link');
                return linkEl ? linkEl.getAttribute('href') : null;
            })
            .filter(Boolean)
    );

    // ограничиваем до 300 ссылок
    const limited = apartLinks.slice(0, 300);

    return limited.map(link => domainUrl + link);
}

// функция загрузки данных апартамента на отдельной странице
async function loadApartmentData(page, url) {
    try {
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        await page.setViewport({ width: 1080, height: 900 });
        await page.waitForSelector('.lot-header__title h1', { timeout: 10000 }).catch(() => null);

        const objectData = {};
        const imgList = [];

        objectData.title = await page.$eval('.lot-header__title h1', el => el.innerText.trim()).catch(() => null);
        objectData.location = await page.$eval('.lot-location', el => el.innerText.trim()).catch(() => null);
        objectData.metro = await page.$$eval('.metro-with-text .js-map-link', els => els.map(el => el.innerText.trim())).catch(() => []);
        objectData.price = await page.$eval('.lot-flat-head .lot-flat-info__top span[itemprop="price"]', el => el.innerText.trim()).catch(() => null);

        const charList = await page.$$eval('.lot-flat-head .lot-flat-about li', els => els.map(el => el.innerText.trim())).catch(() => []);

        objectData.area = charList.find(t => t.includes('м²')) || null;
        objectData.rooms = charList.find(t => t.toLowerCase().includes('комнат') || t.toLowerCase().includes('студия')) || null;
        objectData.level = charList.find(t => t.includes('этаж')) || null;
        objectData.corpys = charList.find(t => t.includes('корпус')) || null;
        objectData.finishing = charList.find(t => t.includes('отделка')) || null;

        await page.waitForSelector('.lot-flat-gallery', { timeout: 5000 }).catch(() => null);

        let imageMain = await page.$$eval(
            '.lot-flat-gallery .fotorama__stage__frame .fotorama__img',
            els => els.length ? els[0].getAttribute('src') : null
        ).catch(() => null);

        if (imageMain) {
            imgList.push(imageMain);
        }

        await scrollRandom(page);
        await delay(randomBetween(1000, 2500));

        const apartData = {
            url_apart: url,
            apart_data: objectData,
            img: imgList
        };

        return apartData;
    } catch (error) {
        console.error(`Ошибка при загрузке данных апартамента ${url}:`, error.message);
        return {
            url_apart: url,
            apart_data: null,
            img: [],
            error: error.message
        };
    }
}

// функция обработки одного объекта (здания)
async function processSingleObject(browser, objUrl) {
    const page = await createPageWithProxyAuth(browser);

    try {
        await page.goto(objUrl, {
            timeout: 30000,
            waitUntil: 'domcontentloaded'
        });
        await page.setViewport({ width: 1080, height: 900 });

        const objectTitle = await page.$eval('.lot-header__title', el => el.innerText.trim()).catch(() => null);
        const objectId = objUrl.split('/').filter(Boolean).pop();
        const wrapperExists = await page.$('.ns-list--wide') ? true : false;

        const buildingObject = {
            title: objectTitle,
            objectId: objectId,
            objectUrl: objUrl,
            appartments: []
        };

        if (wrapperExists) {
            // рекурсивный клик по "Загрузить еще"
            async function clickLoadMore() {
                try {
                    const loadMoreBtn = await page.$('.ns-list__more-btn');
                    if (loadMoreBtn) {
                        const isVisible = await loadMoreBtn.evaluate(btn => {
                            return btn.offsetParent !== null &&
                                btn.getBoundingClientRect().width > 0 &&
                                btn.getBoundingClientRect().height > 0;
                        });

                        if (isVisible) {
                            await scrollToBlock(page, '.ns-list__more-btn');
                            if (!devMode) {
                                await page.click('.ns-list__more-btn');
                                await delay(1200);
                                await clickLoadMore();
                            }
                        }
                    }
                } catch (error) {
                    console.log('Кнопка "Загрузить еще" не найдена или недоступна');
                }
            }

            await clickLoadMore();

            const apartLinks = await getApartmentLinks(page);
            buildingObject.appartments = apartLinks;
        }

        return buildingObject;
    } catch (error) {
        console.error(`Ошибка при обработке объекта ${objUrl}:`, error.message);
        return {
            title: null,
            objectId: objUrl.split('/').filter(Boolean).pop(),
            objectUrl: objUrl,
            appartments: [],
            error: error.message
        };
    } finally {
        await page.close();
    }
}

// функция обработки массива объектов
async function processObjects(browser, objects) {
    const results = [];
    for (const objUrl of objects) {
        const buildingData = await processSingleObject(browser, objUrl);
        results.push(buildingData);
        await delay(randomBetween(2000, 5000)); // Задержка между объектами
    }
    return results;
}

// Функция запуска отдельного браузера с новым прокси для парсинга квартир
async function runBrowserTask(url) {
    const browser = await createBrowserWithProxy();
    const page = await createPageWithProxyAuth(browser);

    console.log(`▶ Парсинг квартиры: ${url} | Прокси: ${browser.proxyData ? browser.proxyData.host : 'нет'}`);

    try {
        const result = await loadApartmentData(page, url);
        return result;
    } catch (error) {
        console.error("Ошибка обработки:", url, error.message);
        return {
            url_apart: url,
            apart_data: null,
            img: [],
            error: error.message
        };
    } finally {
        await browser.close();
        console.log("⛔ Браузер закрыт:", url);
    }
}

// Очередь + пул воркеров (3 параллельно)
async function startParsing(data, maxWorkers = 3) {
    // Собираем все URL квартир в одну очередь
    const queue = [];

    for (const obj of data) {
        queue.push(...obj.appartments);
    }

    console.log(`Всего квартир для парсинга: ${queue.length}`);

    let activeWorkers = 0;
    let index = 0;

    return new Promise(resolve => {
        const results = [];

        const runNext = () => {
            if (index >= queue.length && activeWorkers === 0) {
                resolve(results);
                return;
            }

            while (activeWorkers < maxWorkers && index < queue.length) {
                const url = queue[index++];

                activeWorkers++;

                runBrowserTask(url)
                    .then(res => {
                        results.push(res);
                        console.log(`✅ Обработано: ${url} (${results.length}/${queue.length})`);
                    })
                    .catch(error => {
                        console.error(`❌ Ошибка: ${url}`, error.message);
                        results.push({
                            url_apart: url,
                            apart_data: null,
                            img: [],
                            error: error.message
                        });
                    })
                    .finally(() => {
                        activeWorkers--;
                        runNext(); // запустить следующий в очереди
                    });
            }
        };

        runNext();
    });
}

// Главная функция
(async () => {
    try {
        console.log('🚀 Запуск парсера с прокси...');

        // Создаем браузеры с разными прокси
        const browser1 = await createBrowserWithProxy();
        const browser2 = await createBrowserWithProxy();
        const browser3 = await createBrowserWithProxy();

        console.log('📦 Обработка объектов недвижимости...');

        const [data1, data2, data3] = await Promise.all([
            processObjects(browser1, objects1),
            processObjects(browser2, objects2),
            processObjects(browser3, objects3)
        ]);

        const combinedData = [...data1, ...data2, ...data3];

        console.log('✅ Собраны данные объектов:', combinedData.length);
        fs.writeFileSync('apartments.json', JSON.stringify(combinedData, null, 2), 'utf8');

        await browser1.close();
        await browser2.close();
        await browser3.close();

        console.log('🏠 Начинаем парсинг отдельных квартир...');
        await startParsing(combinedData).then(results => {
            console.log("\n🎉 Парсинг завершен!");
            console.log(`Обработано квартир: ${results.filter(r => !r.error).length} из ${results.length}`);
            fs.writeFileSync('apartments-all.json', JSON.stringify(results, null, 2), 'utf8');
        });

    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
    }
})();