import puppeteer from "puppeteer";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkIp() {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            "--proxy-server=http://dc49.ibaldr.ru:10030"
        ]
    });

    const page = await browser.newPage();

    await page.authenticate({
        username: "2ML86ZNT",
        password: "wL592gMZ"
    });

    await page.goto("https://api.ipify.org?format=json", { waitUntil: "networkidle2" });

    const ip = await page.evaluate(() => document.body.innerText);

    await browser.close();

    return ip;
}

(async () => {
    for (let i = 1; i <= 5; i++) {
        console.log(`--- Проверка №${i} ---`);

        const ip = await checkIp();
        console.log("IP через прокси:", ip);

        if (i < 5) {
            const delay = 30000 + Math.random() * 10000; // 30–40 секунд
            console.log(`Ждём ${(delay / 1000).toFixed(1)} секунд...\n`);
            await sleep(delay);
        }
    }
})();
