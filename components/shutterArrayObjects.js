function splitIntoBuckets(array, bucketsCount) {
    const buckets = Array.from({ length: bucketsCount }, () => []);

    array.forEach((item, index) => {
        const bucketIndex = index % bucketsCount; // равномерное распределение
        buckets[bucketIndex].push(item);
    });

    return buckets;
}

export { splitIntoBuckets }