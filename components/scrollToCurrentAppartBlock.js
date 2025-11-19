// function randomAround(value, percent = 0.1) {
//     const delta = value * percent;
//     return value + (Math.random() * 2 - 1) * delta;
// }
async function scrollToBlock(page, selector, duration = 1000) {
    await page.waitForSelector(selector, { visible: true, timeout: 10000 });

    await page.evaluate(async (selector, duration) => {
        const el = document.querySelector(selector);
        if (!el) return;

        const startY = window.scrollY;
        const rect = el.getBoundingClientRect();
        const targetY = startY + rect.top - window.innerHeight / 2; // скроллим к центру

        const startTime = performance.now();

        function ease(t) {
            // плавная кривая easeInOutQuad
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        return new Promise(resolve => {
            function step() {
                const now = performance.now();
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = ease(progress);

                window.scrollTo(0, startY + (targetY - startY) * eased);

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            }

            requestAnimationFrame(step);
        });
    }, selector, duration);
}


export { scrollToBlock }