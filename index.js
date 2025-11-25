//IMPORT 
import puppeteer from 'puppeteer';
import fs from 'fs';
import { scrollRandom } from './components/scrollPageDown.js';
import { scrollToBlock } from './components/scrollToCurrentAppartBlock.js';
import { splitIntoBuckets } from './components/shutterArrayObjects.js';


//DATA
const devMode = true;

const domainUrl = 'https://avaho.ru';

let proxies = [];

let objectAppartLimit = 300

const objectsListFile = fs.readFileSync('./json/objectList.json', 'utf8');

let objectsList = JSON.parse(objectsListFile)

//Cut array if dev mod true
if (devMode == true) {
    objectsList = objectsList.slice(0, 30)
    objectAppartLimit = 50
}

const [objectsArray1, objectsArray2, objectsArray3] = splitIntoBuckets(objectsList, 3);


console.log(objectsList)

console.log(objectsArray1, objectsArray1.length);

console.log(objectsArray2, objectsArray2.length);

console.log(objectsArray3, objectsArray3.length);


// process.exit(-1);




//FUNCTIONS

// пауза
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//рандомизация для паузы к примеру
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}




// Чтение прокси из JSON файла
try {
    const proxyData = fs.readFileSync('./json/proxy.json', 'utf8');
    proxies = JSON.parse(proxyData);
    console.log(`Загружено прокси: ${proxies.length}`);
} catch (error) {
    console.error('Ошибка загрузки proxy.json:', error);
    proxies = [];
}

function getRandomProxy() {
    if (proxies.length === 0) {
        console.log('Нет доступных прокси, работа без прокси');
        return null;
    }

    const raw = proxies[Math.floor(Math.random() * proxies.length)];
    console.log('Выбран прокси:', raw);

    // Формат: username:password@host:port
    const [auth, hostport] = raw.split("@");
    const [username, password] = auth.split(":");
    const [host, port] = hostport.split(":");

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
        headless: true,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--ignore-certificate-errors',
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
    // const limited = apartLinks.slice(0, 300);
    // return limited.map(link => domainUrl + link);


    return apartLinks.map(link => domainUrl + link);
}

// функция загрузки данных апартамента на отдельной странице
async function loadApartmentData(page, url) {
    try {
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        await page.setViewport({ width: 1080, height: 900 });
        await page.waitForSelector('.lot-header__title h1', { timeout: 20000 }).catch(() => null);

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

        await page.waitForSelector('.fotorama__img', { timeout: 10000 }).catch(() => null);

        let imageMain = await page.$$eval('.fotorama__img', els => els.length ? els[0].getAttribute('src') : null).catch(() => null);

        if (imageMain) {
            imgList.push(imageMain);
        }

        await scrollRandom(page);
        await delay(randomBetween(2000, 5000));

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

// функция обработки одного объекта (здания) - теперь собираем больше данных о ЖК
async function processSingleObject(browser, objUrl) {
    const page = await createPageWithProxyAuth(browser);

    try {
        await page.goto(objUrl, {
            timeout: 60000,
            waitUntil: 'domcontentloaded'
        });
        await page.setViewport({ width: 1080, height: 900 });

        // Собираем расширенные данные о ЖК
        const buildingObject = {
            title: await page.$eval('.lot-header__title', el => el.innerText.trim()).catch(() => null),
            objectId: objUrl.split('/').filter(Boolean).pop(),
            objectUrl: objUrl,
            location: await page.$eval('.lot-location', el => el.innerText.trim()).catch(() => null),
            developer: await page.$eval('.lot-developer a', el => el.innerText.trim()).catch(() => null),
            metro: await page.$$eval('.metro-with-text .js-map-link', els => els.map(el => el.innerText.trim())).catch(() => []),
            description: await page.$eval('.lot-description', el => el.innerText.trim()).catch(() => null),
            features: await page.$$eval('.lot-features li', els => els.map(el => el.innerText.trim())).catch(() => []),
            appartments: [] // здесь будут ссылки на квартиры
        };

        const wrapperExists = await page.$('.ns-list--wide') ? true : false;

        if (wrapperExists) {
            // рекурсивный клик по "Загрузить еще"
            let clickCounterLoadMore = 0
            let maxCountClick = (+objectAppartLimit / 10) - 1

            if (devMode == true) {
                maxCountClick = 1
            }

            async function clickLoadMore() {
                try {
                    const loadMoreBtn = await page.$('.ns-list__more-btn');
                    if (loadMoreBtn) {
                        const isVisible = await loadMoreBtn.evaluate(btn => {
                            return btn.offsetParent !== null &&
                                btn.getBoundingClientRect().width > 0 &&
                                btn.getBoundingClientRect().height > 0;
                        });

                        if (isVisible && clickCounterLoadMore < maxCountClick) {
                            await scrollToBlock(page, '.ns-list__more-btn');
                            await page.click('.ns-list__more-btn');
                            clickCounterLoadMore = clickCounterLoadMore + 1
                            await delay(800);
                            await clickLoadMore();
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

        await delay(randomBetween(2000, 4000));
        await page.close();
    }
}

// функция обработки массива объектов
async function processObjects(browser, objects) {
    const results = [];
    for (const objUrl of objects) {
        const buildingData = await processSingleObject(browser, objUrl);
        results.push(buildingData);
        console.log('обьект обработан', objUrl)
        await delay(randomBetween(2000, 4000)); // Задержка между объектами
    }
    return results;
}

// Функция запуска отдельного браузера с новым прокси для парсинга квартир
async function runBrowserTask(url, buildingId, maxAttempts = 5) {
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        const browser = await createBrowserWithProxy();
        const page = await createPageWithProxyAuth(browser);

        try {
            console.log(`▶ Парсинг квартиры: ${url} | Прокси: ${browser.proxyData ? browser.proxyData.host : 'нет'} | Попытка: ${attempt}`);

            const result = await loadApartmentData(page, url);
            result.building_id = buildingId;

            await browser.close();
            return result; // успешно
        } catch (error) {
            console.error(`❌ Ошибка обработки: ${url} на попытке ${attempt}:`, error.message);
            await browser.close();

            if (attempt < maxAttempts) {
                console.log('⚡ Пробуем другой прокси...');
                await sleep(randomBetween(2000, 5000)); // небольшая пауза перед повтором
            } else {
                return {
                    url_apart: url,
                    apart_data: null,
                    img: [],
                    building_id: buildingId,
                    error: error.message
                };
            }
        }
    }
}





function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Очередь + пул воркеров (3 параллельно)
async function startParsing(data, maxWorkers = 5) {
    const queue = [];

    for (const building of data) {
        for (const apartmentUrl of building.appartments) {
            queue.push({
                url: apartmentUrl,
                buildingId: building.objectId,
                buildingTitle: building.title
            });
        }
    }

    console.log(`Всего квартир для парсинга: ${queue.length}`);

    let activeWorkers = 0;
    let index = 0;
    let processedCount = 0;

    return new Promise(resolve => {
        const results = [];

        const runNext = async () => {

            //  пауза после каждых 50 ссылок
            if (processedCount > 0 && processedCount % 50 === 0) {
                console.log(`⏸ Пауза около 1 минуты после ${processedCount} обработанных ссылок...`);
                await sleep(+randomBetween(45000, 70000));
            }

            if (index >= queue.length && activeWorkers === 0) {
                resolve(results);
                return;
            }

            while (activeWorkers < maxWorkers && index < queue.length) {
                const { url, buildingId, buildingTitle } = queue[index++];

                activeWorkers++;

                runBrowserTask(url, buildingId)
                    .then(res => {
                        results.push(res);
                        processedCount++; // ← добавлено
                        console.log(`✅ Обработано: ${url} (${processedCount}/${queue.length}) | ЖК: ${buildingTitle}`);
                    })
                    .catch(error => {
                        processedCount++; // ← добавлено
                        console.error(`❌ Ошибка: ${url}`, error.message);
                        results.push({
                            url_apart: url,
                            apart_data: null,
                            img: [],
                            building_id: buildingId,
                            error: error.message
                        });
                    })
                    .finally(() => {
                        activeWorkers--;
                        runNext();
                    });
            }
        };

        runNext();
    });
}


// Функция для группировки квартир по ЖК
function groupApartmentsByBuilding(buildingsData, apartmentsData) {
    const result = buildingsData.map(building => {
        // Находим все квартиры, принадлежащие этому ЖК
        const buildingApartments = apartmentsData.filter(apartment =>
            apartment.building_id === building.objectId
        );

        return {
            building_info: {
                title: building.title,
                objectId: building.objectId,
                objectUrl: building.objectUrl,
                location: building.location,
                developer: building.developer,
                metro: building.metro,
                description: building.description,
                features: building.features
            },
            apartments: buildingApartments.map(apt => ({
                url_apart: apt.url_apart,
                apart_data: apt.apart_data,
                img: apt.img,
                error: apt.error
            })),
            stats: {
                total_apartments: buildingApartments.length,
                successful_parsed: buildingApartments.filter(apt => !apt.error && apt.apart_data).length,
                failed_parsed: buildingApartments.filter(apt => apt.error || !apt.apart_data).length
            }
        };
    });

    return result;
}

// Главная функция
(async () => {
    try {
        let startTime = Date.now()
        let endTime = null
        let fullTime = null
        console.log('🚀 Запуск парсера с прокси...');


        // Создаем браузеры с разными прокси
        const browser1 = await createBrowserWithProxy();
        const browser2 = await createBrowserWithProxy();
        const browser3 = await createBrowserWithProxy();

        console.log('📦 Обработка объектов недвижимости...');

        const [data1, data2, data3] = await Promise.all([
            processObjects(browser1, objectsArray1),
            processObjects(browser2, objectsArray2),
            processObjects(browser3, objectsArray3)
        ]);

        const combinedBuildingsData = [...data1, ...data2, ...data3];

        console.log('✅ Собраны данные объектов:', combinedBuildingsData.length);
        fs.writeFileSync('./objects/apartments.json', JSON.stringify(combinedBuildingsData, null, 2), 'utf8');

        await browser1.close();
        await browser2.close();
        await browser3.close();

        console.log('🏠 Начинаем парсинг отдельных квартир...');
        const apartmentsData = await startParsing(combinedBuildingsData);

        console.log('📊 Группируем квартиры по ЖК...');
        const groupedData = groupApartmentsByBuilding(combinedBuildingsData, apartmentsData);

        console.log("\n🎉 Парсинг завершен!");
        console.log(`Обработано ЖК: ${groupedData.length}`);
        console.log(`Обработано квартир: ${apartmentsData.filter(r => !r.error).length} из ${apartmentsData.length}`);

        // Сохраняем сгруппированные данные
        fs.writeFileSync('./objects/apartments-grouped.json', JSON.stringify(groupedData, null, 2), 'utf8');
        fs.writeFileSync('./objects/apartments-all.json', JSON.stringify(apartmentsData, null, 2), 'utf8');

        // Выводим статистику по каждому ЖК
        groupedData.forEach(building => {
            console.log(`🏢 ${building.building_info.title}: ${building.stats.successful_parsed}/${building.stats.total_apartments} квартир`);
        });

        endTime = Date.now()

        console.log('Время затраченое на работу', formatDuration(endTime - startTime));


    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
    }
})();