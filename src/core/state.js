/**
 * Centralized State Management for the Application
 */
export const state = {
    currentFolderId: '1',
    allItems: [],
    navigationStack: [],
    viewMode: 'folder', // 'folder', 'time', 'card'
    searchTerm: '',
    currentLanguage: 'en',
    fontSize: 22,
    darkMode: false,
    isSearching: false,
    isTimeView: false,
    isCardView: false
};

/**
 * Updates a state property and optionally triggers a callback
 * @param {string} key - State property to update
 * @param {any} value - New value
 * @param {Function} [callback] - Optional callback to run after update
 */
export function setState(key, value, callback = null) {
    state[key] = value;
    if (callback) {
        callback(value);
    }
}

/**
 * Returns the current state
 */
export function getState() {
    return { ...state };
}
