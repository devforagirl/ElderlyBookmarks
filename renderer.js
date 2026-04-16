// Constants
const BUFFER_SIZE = 5;
const DEFAULT_FONT_SIZE = 22;

// State
let allItems = []; 
let navigationStack = []; 
let isSearching = false;
let isTimeView = false;
let isCardView = false;
let currentFolderId = '0';
let currentFontSize = DEFAULT_FONT_SIZE;
let currentRowHeight = 80; 
let targetItemForAction = null; 
let currentLanguage = 'auto'; // 'auto' or 'en', 'zh_CN', etc.

// DOM Elements
const listContainer = document.getElementById('list-container');
const listPhantom = document.getElementById('list-phantom');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const searchInput = document.getElementById('search-input');
const searchContainer = document.getElementById('search-container');
const btnSearch = document.getElementById('btn-search');
const btnSettings = document.getElementById('btn-settings');
const settingsCard = document.getElementById('settings-card');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeDisplay = document.getElementById('font-size-display');
const viewModeRadios = document.getElementsByName('view-mode');
const btnScrollTop = document.getElementById('btn-scroll-top');
const btnScrollBottom = document.getElementById('btn-scroll-bottom');
const darkModeSwitch = document.getElementById('dark-mode-switch');
const languageSelect = document.getElementById('language-select');
const errorToast = document.getElementById('error-toast');

// Modal Elements
const modalDelete = document.getElementById('modal-delete');
const modalDeleteText = document.getElementById('modal-delete-text');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');
const btnDeleteConfirm = document.getElementById('btn-delete-confirm');

const modalEdit = document.getElementById('modal-edit');
const editTitleInput = document.getElementById('edit-title');
const editUrlInput = document.getElementById('edit-url');
const editUrlGroup = document.getElementById('edit-url-group');
const btnEditCancel = document.getElementById('btn-edit-cancel');
const btnEditSave = document.getElementById('btn-edit-save');


// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Settings (including Language)
    loadSettings();

    // 2. Apply Translations
    applyTranslations();

    // 3. Start at root
    if (isTimeView) {
        await enterTimeView();
    } else {
        // Initial Replace State to ensure we have a starting point (Home)
        await navigateTo('0', t("crumbHome"));
    }
    
    // Attach scroll listener for virtual rendering
    listContainer.addEventListener('scroll', onScroll);
    window.addEventListener('resize', () => {
        updatePhantomHeight();
        onScroll();
    });

    // Search Input listener
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleSearch(false);
        }
    });

    // Button Listeners
    btnSearch.addEventListener('click', () => {
        const isHidden = searchContainer.classList.contains('hidden');
        toggleSearch(isHidden); 
    });

    btnSettings.addEventListener('click', () => {
        const isHidden = settingsCard.classList.contains('hidden');
        toggleSettings(isHidden);
    });

    // Slider Listener
    fontSizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value, 10);
        updateSizeSettings(size);
        saveSetting('fontSize', size);
    });

    // View Mode Listener
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (e.target.value === 'time') {
                    isTimeView = true;
                    isCardView = false;
                    saveSetting('viewMode', 'time');
                    enterTimeView();
                } else if (e.target.value === 'card') {
                    isCardView = true;
                    isTimeView = false;
                    saveSetting('viewMode', 'card');
                    updatePhantomHeight();
                    onScroll();
                } else {
                    isTimeView = false;
                    isCardView = false;
                    saveSetting('viewMode', 'folder');
                    isSearching = false;
                    navigateTo(currentFolderId, navigationStack[navigationStack.length-1]?.title || t("crumbHome"));
                }
            }
        });    });

    // Dark Mode Listener
    darkModeSwitch.addEventListener('change', (e) => {
        toggleDarkMode(e.target.checked);
        saveSetting('darkMode', e.target.checked);
    });

    // Language Listener
    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        saveSetting('language', currentLanguage);
        applyTranslations(); // Re-translate UI
        refreshCurrentView(); // Re-render list content (e.g. date headers)
    });

    // Scroll Buttons
    btnScrollTop.addEventListener('click', () => {
        listContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });

    btnScrollBottom.addEventListener('click', () => {
        listContainer.scrollTo({ top: listContainer.scrollHeight, behavior: 'smooth' });
    });

    // Close Settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsCard.classList.contains('hidden')) {
            if (!settingsCard.contains(e.target) && !btnSettings.contains(e.target)) {
                toggleSettings(false);
            }
        }
    });

    // Modal Listeners
    setupModals();
});

// Translation Engine
function t(key, placeholders = []) {
    let lang = currentLanguage;
    
    // If auto, detect browser language
    if (lang === 'auto') {
        const uiLang = chrome.i18n.getUILanguage(); // e.g. "en-US", "zh-CN"
        // Try exact match first
        if (LOCALES[uiLang]) {
            lang = uiLang;
        } else {
            // Try prefix match (e.g. "en-GB" -> "en")
            const prefix = uiLang.split('-')[0];
            if (LOCALES[prefix]) {
                lang = prefix;
            } else {
                // Fallback to zh_CN for "zh" if not zh_TW
                if (prefix === 'zh') lang = 'zh_CN';
                else lang = 'en'; // Ultimate fallback
            }
        }
        
        // Ensure the mapped lang actually exists in our LOCALES
        if (!LOCALES[lang]) lang = 'en';
    }

    const dict = LOCALES[lang] || LOCALES['en'];
    let message = dict[key] || key;

    // Handle simple placeholders like $1, $2 (if we implemented that logic, but we kept it simple)
    // Our JSON uses $TITLE$ etc. Let's just handle specific known keys or generic replace
    // Actually, chrome.i18n logic is complex. For LOCALES.js, let's just do simple replacement if array provided.
    // Assuming simple string replacement for now or specialized logic where needed.
    
    if (key === 'msgDeleteConfirm' && placeholders.length > 0) {
        return message.replace('$TITLE$', placeholders[0]);
    }

    return message;
}

// Helper: Apply i18n to static HTML
function applyTranslations() {
    // Translate text content
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // Translate placeholders
    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

// Helper for Safe API Calls
function safeAPI(apiFunction, ...args) {
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

function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.add('visible');
    setTimeout(() => {
        errorToast.classList.remove('visible');
    }, 3000);
}

// Settings Logic
function loadSettings() {
    const savedFontSize = localStorage.getItem('setting_fontSize');
    const savedViewMode = localStorage.getItem('setting_viewMode');
    const savedDarkMode = localStorage.getItem('setting_darkMode');
    const savedLanguage = localStorage.getItem('setting_language');

    if (savedFontSize) {
        const size = parseInt(savedFontSize, 10);
        fontSizeSlider.value = size;
        updateSizeSettings(size);
    } else {
        updateSizeSettings(DEFAULT_FONT_SIZE);
    }

    if (savedViewMode === 'time') {
        isTimeView = true;
        document.querySelector('input[value="time"]').checked = true;
    } else if (savedViewMode === 'card') {
        isCardView = true;
        document.querySelector('input[value="card"]').checked = true;
    } else {
        isTimeView = false;
        isCardView = false;
        document.querySelector('input[value="folder"]').checked = true;
    }

    if (savedDarkMode === 'true') {
        toggleDarkMode(true);
        darkModeSwitch.checked = true;
    } else {
        toggleDarkMode(false);
        darkModeSwitch.checked = false;
    }

    if (savedLanguage) {
        currentLanguage = savedLanguage;
        languageSelect.value = savedLanguage;
    } else {
        currentLanguage = 'auto';
        languageSelect.value = 'auto';
    }
}

function saveSetting(key, value) {
    localStorage.setItem(`setting_${key}`, value);
}

function toggleDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function updateSizeSettings(size) {
    currentFontSize = size;
    currentRowHeight = Math.floor(size * 3.6); 
    document.documentElement.style.setProperty('--font-base', `${size}px`);
    document.documentElement.style.setProperty('--row-height', `${currentRowHeight}px`);
    fontSizeDisplay.textContent = `${size}px`;
    updatePhantomHeight();
    renderVisibleItems();
}

function toggleSearch(show) {
    if (show) {
        searchContainer.classList.remove('hidden');
        btnSearch.classList.add('active');
        searchInput.focus();
        toggleSettings(false);
    } else {
        searchContainer.classList.add('hidden');
        btnSearch.classList.remove('active');
        
        // Clear search content and restore view
        if (isSearching) {
            searchInput.value = '';
            isSearching = false;
            if (isTimeView) {
                enterTimeView();
            } else {
                const current = navigationStack[navigationStack.length - 1];
                if (current) navigateTo(current.id, current.title);
            }
        } else {
            searchInput.value = ''; 
        }
    }
}

function toggleSettings(show) {
    if (show) {
        settingsCard.classList.remove('hidden');
        btnSettings.classList.add('active');
        toggleSearch(false);
    } else {
        settingsCard.classList.add('hidden');
        btnSettings.classList.remove('active');
    }
}

// Navigation Logic
async function navigateTo(folderId, title) {
    if (isSearching) {
        searchInput.value = '';
        isSearching = false;
        toggleSearch(false); 
    }

    currentFolderId = folderId; 

    const index = navigationStack.findIndex(item => item.id === folderId);
    if (index !== -1) {
        navigationStack = navigationStack.slice(0, index + 1);
    } else {
        // Use translation for Home only if title is missing
        navigationStack.push({ id: folderId, title: title || t("crumbHome") });
    }

    updateBreadcrumbs();

    try {
        const children = await safeAPI(chrome.bookmarks.getChildren, folderId);
        allItems = children; 
        
        listContainer.scrollTop = 0;
        updatePhantomHeight();
        renderVisibleItems();
    } catch (err) {
        showError(t("msgErrLoadFolder") + err);
    }
}

// Time View Logic
async function enterTimeView() {
    try {
        const fullTree = await safeAPI(chrome.bookmarks.getTree);
        let flatBookmarks = [];
        
        function traverse(nodes) {
            for (const node of nodes) {
                if (node.url) {
                    flatBookmarks.push(node);
                }
                if (node.children) {
                    traverse(node.children);
                }
            }
        }
        traverse(fullTree);

        flatBookmarks.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
        allItems = groupBookmarksByTime(flatBookmarks);

        listContainer.scrollTop = 0;
        updatePhantomHeight();
        
        breadcrumbsContainer.innerHTML = `
            <span class="crumb" style="cursor:default">${t("crumbTimeView")}</span>
            <span class="crumb-separator" id="time-view-separator" style="display:none">></span>
            <span class="crumb" id="time-view-label" style="cursor:default; color: var(--folder-icon-color);"></span>
        `;

        renderVisibleItems();
    } catch (err) {
        showError(t("msgErrLoadTime") + err);
    }
}

function groupBookmarksByTime(bookmarks) {
    const groupedList = [];
    const now = new Date();
    
    const oneDay = 24 * 60 * 60 * 1000;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const weekAgo = today - (7 * oneDay);
    const monthAgo = today - (30 * oneDay);
    const threeMonthsAgo = today - (90 * oneDay);
    const sixMonthsAgo = today - (180 * oneDay);
    const thisYearStart = new Date(now.getFullYear(), 0, 1).getTime();

    let lastGroup = null;

    for (const b of bookmarks) {
        const date = b.dateAdded || 0;
        let group = '';

        if (date >= today) group = t("groupToday");
        else if (date >= weekAgo) group = t("groupWeek");
        else if (date >= monthAgo) group = t("groupMonth");
        else if (date >= threeMonthsAgo) group = t("group3Months");
        else if (date >= sixMonthsAgo) group = t("group6Months");
        else if (date >= thisYearStart) group = t("groupYear");
        else group = t("groupEarlier"); 

        if (group === t("groupEarlier")) {
             const bYear = new Date(date).getFullYear();
             if (bYear < now.getFullYear()) {
                 group = `${bYear}${t("yearSuffix")}`;
             }
        }

        if (group !== lastGroup) {
            groupedList.push({ type: 'header', title: group });
            lastGroup = group;
        }

        groupedList.push(b);
    }
    return groupedList;
}

// Breadcrumbs UI
function updateBreadcrumbs() {
    breadcrumbsContainer.innerHTML = '';
    
    navigationStack.forEach((item, index) => {
        const span = document.createElement('span');
        span.className = 'crumb';
        span.textContent = item.title;
        span.onclick = () => {
             if (isTimeView) {
                 const folderRadio = Array.from(viewModeRadios).find(r => r.value === 'folder');
                 if(folderRadio) {
                     folderRadio.checked = true;
                     folderRadio.dispatchEvent(new Event('change')); 
                 }
                 setTimeout(() => navigateTo(item.id, item.title), 0);
             } else {
                 navigateTo(item.id, item.title);
             }
        };
        
        breadcrumbsContainer.appendChild(span);

        if (index < navigationStack.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'crumb-separator';
            separator.textContent = '>';
            breadcrumbsContainer.appendChild(separator);
        }
    });
}

// Virtual List Logic
function getColumns() {
    if (!listContainer) return 1;
    const minCardWidth = 250;
    return Math.max(1, Math.floor(listContainer.clientWidth / minCardWidth));
}

function onScroll() {
    requestAnimationFrame(renderVisibleItems);
}

function updatePhantomHeight() {
    if (allItems.length === 0) {
        listPhantom.style.height = '0px';
    } else {
        if (isCardView) {
            const cols = getColumns();
            const rows = Math.ceil(allItems.length / cols);
            listPhantom.style.height = `${rows * currentRowHeight}px`;
        } else {
            listPhantom.style.height = `${allItems.length * currentRowHeight}px`;
        }
    }
}

function renderVisibleItems() {
    if (allItems.length === 0) {
        listContainer.innerHTML = `
            <div id="list-phantom"></div>
            <div class="empty-state">${t("msgEmpty")}</div>
        `;
        return;
    }

    const scrollTop = listContainer.scrollTop;
    const viewportHeight = listContainer.clientHeight;
    
    let startIndex, endIndex;
    if (isCardView) {
        const cols = getColumns();
        startIndex = Math.floor(scrollTop / currentRowHeight) * cols;
        endIndex = Math.min(
            allItems.length - 1,
            Math.ceil((scrollTop + viewportHeight) / currentRowHeight) * cols + BUFFER_SIZE
        );
    } else {
        startIndex = Math.floor(scrollTop / currentRowHeight);
        endIndex = Math.min(
            allItems.length - 1,
            Math.floor((scrollTop + viewportHeight) / currentRowHeight) + BUFFER_SIZE
        );
    }

    if (isTimeView && allItems.length > 0) {
        let currentHeader = '';
        for (let i = startIndex; i >= 0; i--) {
            if (allItems[i] && allItems[i].type === 'header') {
                currentHeader = allItems[i].title;
                break;
            }
        }
        
        const labelEl = document.getElementById('time-view-label');
        const sepEl = document.getElementById('time-view-separator');
        
        if (labelEl && sepEl) {
            if (currentHeader) {
                labelEl.textContent = currentHeader;
                sepEl.style.display = 'inline';
            } else {
                labelEl.textContent = '';
                sepEl.style.display = 'none';
            }
        }
    }

    const currentItems = Array.from(listContainer.querySelectorAll('.list-item, .section-header, .empty-state'));
    currentItems.forEach(el => el.remove());

    if (!document.getElementById('list-phantom')) {
        const p = document.createElement('div');
        p.id = 'list-phantom';
        p.style.height = `${allItems.length * currentRowHeight}px`;
        listContainer.appendChild(p);
    }

    for (let i = startIndex; i <= endIndex; i++) {
        const item = allItems[i];
        if (!item) continue;
        
        let el;
        if (item.type === 'header') {
            el = createHeaderRow(item, i);
        } else if (isCardView) {
            el = createCard(item, i);
        } else {
            el = createRow(item, i);
        }
        listContainer.appendChild(el);
    }
}

function createHeaderRow(item, index) {
    const div = document.createElement('div');
    div.className = 'section-header';
    div.style.top = `${index * currentRowHeight}px`;
    div.textContent = item.title;
    return div;
}

function createCard(item, index) {
    const cols = getColumns();
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cardWidth = Math.max(100, listContainer.clientWidth / cols);

    const div = document.createElement('div');
    div.className = 'bookmark-card';
    if (!item.url) div.classList.add('is-folder');

    div.style.top = `${row * currentRowHeight}px`;
    div.style.left = `${col * cardWidth}px`;
    div.style.width = `${cardWidth - 20}px`; // Subtract gap
    div.style.height = `${currentRowHeight - 20}px`; // Subtract gap

    const textDiv = document.createElement('div');
    textDiv.className = 'card-text';
    textDiv.textContent = item.title;
    div.appendChild(textDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'action-btn btn-edit';
    btnEdit.textContent = t("btnLabelEdit");
    btnEdit.onclick = (e) => {
        e.stopPropagation();
        openEditModal(item);
    };

    const btnDelete = document.createElement('button');
    btnDelete.className = 'action-btn btn-delete';
    btnDelete.textContent = t("btnLabelDelete");
    btnDelete.onclick = (e) => {
        e.stopPropagation();
        openDeleteModal(item);
    };

    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDelete);
    div.appendChild(actionsDiv);

    div.onclick = () => handleItemClick(item);

    return div;
}

function createRow(item, index) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.style.top = `${index * currentRowHeight}px`;
    
    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'item-icon';
    
    if (item.url) {
        const img = document.createElement('img');
        const urlObj = new URL(chrome.runtime.getURL("/_favicon/"));
        urlObj.searchParams.set("pageUrl", item.url);
        urlObj.searchParams.set("size", "64"); 
        img.src = urlObj.toString();
        img.onerror = () => {
             iconDiv.innerHTML = `<svg><use href="#icon-web"></use></svg>`;
        };
        iconDiv.appendChild(img);
    } else {
        iconDiv.innerHTML = `<svg class="folder-icon"><use href="#icon-folder"></use></svg>`;
    }

    // Text
    const textDiv = document.createElement('div');
    textDiv.className = 'item-text';
    textDiv.textContent = item.title;

    // Actions (Edit/Delete)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    // Edit Button
    const btnEdit = document.createElement('button');
    btnEdit.className = 'action-btn btn-edit';
    btnEdit.textContent = t("btnLabelEdit"); 
    btnEdit.title = t("modalEditTitle"); 
    btnEdit.onclick = (e) => {
        e.stopPropagation();
        openEditModal(item);
    };

    // Delete Button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'action-btn btn-delete';
    btnDelete.textContent = t("btnLabelDelete"); 
    btnDelete.title = t("modalDeleteTitle"); 
    btnDelete.onclick = (e) => {
        e.stopPropagation();
        openDeleteModal(item);
    };

    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDelete);

    div.appendChild(iconDiv);
    div.appendChild(textDiv);
    div.appendChild(actionsDiv);

    div.onclick = () => handleItemClick(item);

    return div;
}

function handleItemClick(item) {
    if (item.url) {
        chrome.tabs.create({ url: item.url });
    } else {
        navigateTo(item.id, item.title);
    }
}

// Search Logic
async function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
        if (isTimeView) {
            enterTimeView(); 
        } else {
            const current = navigationStack[navigationStack.length - 1];
            if(current) navigateTo(current.id, current.title);
        }
        isSearching = false;
        return;
    }

    isSearching = true;
    try {
        const results = await safeAPI(chrome.bookmarks.search, query);
        allItems = results; 
        
        listContainer.scrollTop = 0;
        updatePhantomHeight();
        renderVisibleItems();
        
        breadcrumbsContainer.innerHTML = `<span class="crumb">${t("crumbSearch")}</span>`;
    } catch (err) {
        showError(t("msgErrSearch") + err);
    }
}

// Utils
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// --- MODAL LOGIC ---

function setupModals() {
    // Delete Modal
    btnDeleteCancel.onclick = () => {
        modalDelete.classList.add('hidden');
        targetItemForAction = null;
    };
    btnDeleteConfirm.onclick = async () => {
        if (targetItemForAction) {
            try {
                if (targetItemForAction.children) {
                     await safeAPI(chrome.bookmarks.removeTree, targetItemForAction.id);
                } else {
                     await safeAPI(chrome.bookmarks.remove, targetItemForAction.id);
                }
                
                await refreshCurrentView();
                modalDelete.classList.add('hidden');
                targetItemForAction = null;
            } catch (err) {
                showError(t("msgErrDelete") + err);
            }
        }
    };

    // Edit Modal
    btnEditCancel.onclick = () => {
        modalEdit.classList.add('hidden');
        targetItemForAction = null;
    };
    btnEditSave.onclick = async () => {
        if (targetItemForAction) {
            // INPUT VALIDATION
            const newTitle = editTitleInput.value.trim();
            const newUrl = editUrlInput.value.trim();

            if (!newTitle) {
                showError(t("msgErrNameEmpty"));
                return;
            }

            if (targetItemForAction.url && !newUrl) {
                showError(t("msgErrUrlEmpty"));
                return;
            }

            const updates = { title: newTitle };
            if (targetItemForAction.url) {
                updates.url = newUrl;
            }

            try {
                await safeAPI(chrome.bookmarks.update, targetItemForAction.id, updates);
                await refreshCurrentView();
                modalEdit.classList.add('hidden');
                targetItemForAction = null;
            } catch (err) {
                showError(t("msgErrUpdate") + err);
            }
        }
    };
}

function openDeleteModal(item) {
    targetItemForAction = item;
    // Replace placeholder $TITLE$ with item title
    const msg = t("msgDeleteConfirm", [item.title]);
    modalDeleteText.textContent = msg;
    modalDelete.classList.remove('hidden');
}

function openEditModal(item) {
    targetItemForAction = item;
    editTitleInput.value = item.title;
    
    if (item.url) {
        editUrlGroup.style.display = 'flex';
        editUrlInput.value = item.url;
    } else {
        editUrlGroup.style.display = 'none'; 
    }
    
    modalEdit.classList.remove('hidden');
}

async function refreshCurrentView() {
    const savedScrollTop = listContainer.scrollTop;

    try {
        if (isTimeView) {
            const fullTree = await safeAPI(chrome.bookmarks.getTree);
            let flatBookmarks = [];
            function traverse(nodes) {
                for (const node of nodes) {
                    if (node.url) flatBookmarks.push(node);
                    if (node.children) traverse(node.children);
                }
            }
            traverse(fullTree);
            flatBookmarks.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
            allItems = groupBookmarksByTime(flatBookmarks);

        } else if (isSearching) {
            const query = searchInput.value.toLowerCase();
            const results = await safeAPI(chrome.bookmarks.search, query);
            allItems = results;
        } else {
            const children = await safeAPI(chrome.bookmarks.getChildren, currentFolderId);
            allItems = children;
        }

        updatePhantomHeight();
        listContainer.scrollTop = savedScrollTop;
        renderVisibleItems();
    } catch (err) {
        showError(t("msgErrRefresh") + err);
    }
}