// функция для рандомного числа в пределах ±10%
function randomAround(value, percent = 0.1) {
    const delta = value * percent;
    return value + (Math.random() * 2 - 1) * delta;
}

// пример использования в скролле
async function scrollRandom(page, targetPercents = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1], durationRange = [600, 1200], stepPercentRange = [0.1, 0.4]) {
    // высота страницы
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    // выбираем целевой процент
    const targetPercent = targetPercents[Math.floor(Math.random() * targetPercents.length)];
    const targetY = pageHeight * targetPercent;

    let currentY = await page.evaluate(() => window.scrollY);

    while (currentY < targetY) {
        // выбираем случайный процент следующего шага
        const stepPercent = Math.random() * (stepPercentRange[1] - stepPercentRange[0]) + stepPercentRange[0];
        let nextY = currentY + pageHeight * stepPercent;

        if (nextY > targetY) nextY = targetY;

        // случайная длительность подхода
        const duration = Math.floor(Math.random() * (durationRange[1] - durationRange[0] + 1)) + durationRange[0];

        // выполняем плавный скролл к nextY
        await page.evaluate(async (startY, endY, duration) => {
            const startTime = performance.now();

            function ease(t) {
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
            }

            return new Promise(resolve => {
                function step() {
                    const now = performance.now();
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = ease(progress);

                    window.scrollTo(0, startY + (endY - startY) * eased);

                    if (progress < 1) {
                        requestAnimationFrame(step);
                    } else {
                        resolve();
                    }
                }
                requestAnimationFrame(step);
            });
        }, currentY, nextY, duration);

        currentY = nextY;
    }
}

export { scrollRandom }