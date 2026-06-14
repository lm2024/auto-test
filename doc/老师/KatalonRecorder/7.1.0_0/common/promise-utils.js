async function retryUntilSuccess(func, maxRetry = 30, interval = 100) {
    while (maxRetry > 0) {
        try {
            return await func();
        } catch (e) {
            maxRetry--;
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }
    throw new Error('Retry failed');
}