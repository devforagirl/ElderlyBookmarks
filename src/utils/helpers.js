/**
 * Helper for Safe API Calls
 * Wraps Chrome API callback-based functions into Promises
 */
export function safeAPI(apiFunction, ...args) {
    return new Promise((resolve, reject) => {
        apiFunction(...args, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Displays a temporary error message to the user
 * @param {string} msg - The error message to display
 * @param {HTMLElement} [toastElement] - Optional element to use for the toast
 */
export function showError(msg, toastElement) {
    const element = toastElement || document.getElementById('errorToast');
    if (!element) {
        console.error('Error toast element not found:', msg);
        return;
    }
    element.textContent = msg;
    element.classList.add('visible');
    setTimeout(() => {
        element.classList.remove('visible');
    }, 3000);
}
