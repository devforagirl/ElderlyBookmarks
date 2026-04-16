import { t, setLanguage } from '../core/i18n.js';
import { BookmarkService } from '../services/bookmark.js';
import { safeAPI, showError } from '../utils/helpers.js';
import { state, setState } from '../core/state.js';

const BUFFER_SIZE = 5;
const DEFAULT_FONT_SIZE = 22;

export async function initialize() {
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

    let currentRowHeight = 80;
    let targetItemForAction = null;

    // --- INTERNAL HELPERS ---
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

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
            setState('isTimeView', true);
            document.querySelector('input[value="time"]').checked = true;
        } else if (savedViewMode === 'card') {
            setState('isCardView', true);
            document.querySelector('input[value="card"]').checked = true;
        } else {
            setState('isTimeView', false);
            setState('isCardView', false);
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
            setLanguage(savedLanguage);
            languageSelect.value = savedLanguage;
        } else {
            setLanguage('auto');
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
            if (state.isSearching) {
                searchInput.value = '';
                setState('isSearching', false);
                if (state.isTimeView) {
                    await enterTimeView();
                } else {
                    const current = state.navigationStack[state.navigationStack.length - 1];
                    if (current) await navigateTo(current.id, current.title);
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

    async function navigateTo(folderId, title) {
        if (state.isSearching) {
            searchInput.value = '';
            setState('isSearching', false);
            toggleSearch(false);
        }

        setState('currentFolderId', folderId);

        const index = state.navigationStack.findIndex(item => item.id === folderId);
        if (index !== -1) {
            setState('navigationStack', state.navigationStack.slice(0, index + 1));
        } else {
            setState('navigationStack', [...state.navigationStack, { id: folderId, title: title || t("crumbHome") }]);
        }

        updateBreadcrumbs();

        try {
            const children = await BookmarkService.getChildren(folderId);
            setState('allItems', children);
            listContainer.scrollTop = 0;
            updatePhantomHeight();
            renderVisibleItems();
        } catch (err) {
            showError(t("msgErrLoadFolder") + err);
        }
    }

    async function enterTimeView() {
        try {
            const fullTree = await BookmarkService.getTree();
            const flatBookmarks = BookmarkService.flattenTree(fullTree);
            flatBookmarks.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
            
            setState('allItems', BookmarkService.groupBookmarksByTime(flatBookmarks, t));

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

    function updateBreadcrumbs() {
        breadcrumbsContainer.innerHTML = '';
        state.navigationStack.forEach((item, index) => {
            const span = document.createElement('span');
            span.className = 'crumb';
            span.textContent = item.title;
            span.onclick = () => {
                if (state.isTimeView) {
                    const folderRadio = Array.from(viewModeRadios).find(r => r.value === 'folder');
                    if (folderRadio) {
                        folderRadio.checked = true;
                        folderRadio.dispatchEvent(new Event('change'));
                    }
                    setTimeout(() => navigateTo(item.id, item.title), 0);
                } else {
                    navigateTo(item.id, item.title);
                }
            };
            breadcrumbsContainer.appendChild(span);
            if (index < state.navigationStack.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'crumb-separator';
                separator.textContent = '>';
                breadcrumbsContainer.appendChild(separator);
            }
        });
    }

    function getColumns() {
        if (!listContainer) return 1;
        const minCardWidth = 250;
        return Math.max(1, Math.floor(listContainer.clientWidth / minCardWidth));
    }

    function updatePhantomHeight() {
        if (state.allItems.length === 0) {
            listPhantom.style.height = '0px';
        } else {
            if (state.isCardView) {
                const cols = getColumns();
                const rows = Math.ceil(state.allItems.length / cols);
                listPhantom.style.height = `${rows * currentRowHeight}px`;
            } else {
                listPhantom.style.height = `${state.allItems.length * currentRowHeight}px`;
            }
        }
    }

    function renderVisibleItems() {
        if (state.allItems.length === 0) {
            listContainer.innerHTML = `
                <div id="list-phantom"></div>
                <div class="empty-state">${t("msgEmpty")}</div>
            `;
            return;
        }

        const scrollTop = listContainer.scrollTop;
        const viewportHeight = listContainer.clientHeight;
        let startIndex, endIndex;

        if (state.isCardView) {
            const cols = getColumns();
            startIndex = Math.floor(scrollTop / currentRowHeight) * cols;
            endIndex = Math.min(state.allItems.length - 1, Math.ceil((scrollTop + viewportHeight) / currentRowHeight) * cols + BUFFER_SIZE);
        } else {
            startIndex = Math.floor(scrollTop / currentRowHeight);
            endIndex = Math.min(state.allItems.length - 1, Math.floor((scrollTop + viewportHeight) / currentRowHeight) + BUFFER_SIZE);
        }

        if (state.isTimeView && state.allItems.length > 0) {
            let currentHeader = '';
            for (let i = startIndex; i >= 0; i--) {
                if (state.allItems[i] && state.allItems[i].type === 'header') {
                    currentHeader = state.allItems[i].title;
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
            listPhantom.style.height = `${state.allItems.length * currentRowHeight}px`;
            listContainer.appendChild(p);
        }

        for (let i = startIndex; i <= endIndex; i++) {
            const item = state.allItems[i];
            if (!item) continue;
            let el;
            if (item.type === 'header') {
                el = createHeaderRow(item, i);
            } else if (state.isCardView) {
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
        div.style.width = `${cardWidth - 20}px`;
        div.style.height = `${currentRowHeight - 20}px`;
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
        const textDiv = document.createElement('div');
        textDiv.className = 'item-text';
        textDiv.textContent = item.title;
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';
        const btnEdit = document.createElement('button');
        btnEdit.className = 'action-btn btn-edit';
        btnEdit.textContent = t("btnLabelEdit");
        btnEdit.title = t("modalEditTitle");
        btnEdit.onclick = (e) => {
            e.stopPropagation();
            openEditModal(item);
        }
        const btnDelete = document.createElement('button');
        btnDelete.className = 'action-btn btn-delete';
        btnDelete.textContent = t("btnLabelDelete");
        btnDelete.title = t("modalDeleteTitle");
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            openDeleteModal(item);
        }
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

    async function handleSearch(e) {
        const query = e.target.value.toLowerCase();
        if (!query) {
            if (state.isTimeView) {
                await enterTimeView();
            } else {
                const current = state.navigationStack[state.navigationStack.length - 1];
                if (current) await navigateTo(current.id, current.title);
            }
            setState('isSearching', false);
            return;
        }
        setState('isSearching', true);
        try {
            const results = await BookmarkService.search(query);
            setState('allItems', results);
            listContainer.scrollTop = 0;
            updatePhantomHeight();
            renderVisibleItems();
            breadcrumbsContainer.innerHTML = `<span class="crumb">${t("crumbSearch")}</span>`;
        } catch (err) {
            showError(t("msgErrSearch") + err);
        }
    }

    function setupModals() {
        btnDeleteCancel.onclick = () => {
            modalDelete.classList.add('hidden');
            targetItemForAction = null;
        };
        btnDeleteConfirm.onclick = async () => {
            if (targetItemForAction) {
                try {
                    if (targetItemForAction.children) {
                        await BookmarkService.remove(targetItemForAction.id, true);
                    } else {
                        await BookmarkService.remove(targetItemForAction.id);
                    }
                    await refreshCurrentView();
                    modalDelete.classList.add('hidden');
                    targetItemForAction = null;
                } catch (err) {
                    showError(t("msgErrDelete") + err);
                }
            }
        };
        btnEditCancel.onclick = () => {
            modalEdit.classList.add('hidden');
            targetItemForAction = null;
        };
        btnEditSave.onclick = async () => {
            if (targetItemForAction) {
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
                    await BookmarkService.update(targetItemForAction.id, updates);
                    await refreshCurrentView();
                    modalEdit.classList.add('hidden');
                    targetItemForAction = null;
                } catch (err) {
                    showError(t("msgErrUpdate") + err);
                }
            }
        };
    }

    async function refreshCurrentView() {
        const savedScrollTop = listContainer.scrollTop;
        try {
            if (state.isTimeView) {
                const fullTree = await BookmarkService.getTree();
                const flatBookmarks = BookmarkService.flattenTree(fullTree);
                flatBookmarks.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
                setState('allItems', BookmarkService.groupBookmarksByTime(flatBookmarks, t));
            } else if (state.isSearching) {
                const query = searchInput.value.toLowerCase();
                const results = await BookmarkService.search(query);
                setState('allItems', results);
            } else {
                const children = await BookmarkService.getChildren(state.currentFolderId);
                setState('allItems', children);
            }
            updatePhantomHeight();
            listContainer.scrollTop = savedScrollTop;
            renderVisibleItems();
        } catch (err) {
            showError(t("msgErrRefresh") + err);
        }
    }

    function applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });
        const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key);
        });
    }

    // --- INITIALIZATION ---
    loadSettings();
    applyTranslations();

    if (state.isTimeView) {
        await enterTimeView();
    } else {
        await navigateTo('0', t("crumbHome"));
    }

    listContainer.addEventListener('scroll', onScroll);
    window.addEventListener('resize', () => {
        updatePhantomHeight();
        onScroll();
    });

    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleSearch(false);
        }
    });

    btnSearch.addEventListener('click', () => {
        const isHidden = searchContainer.classList.contains('hidden');
        toggleSearch(isHidden);
    });

    btnSettings.addEventListener('click', () => {
        const isHidden = settingsCard.classList.contains('hidden');
        toggleSettings(isHidden);
    });

    fontSizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value, 10);
        updateSizeSettings(size);
        saveSetting('fontSize', size);
    });

    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (e.target.value === 'time') {
                    setState('isTimeView', true);
                    setState('isCardView', false);
                    saveSetting('viewMode', 'time');
                    enterTimeView();
                } else if (e.target.value === 'card') {
                    setState('isCardView', true);
                    setState('isTimeView', false);
                    saveSetting('viewMode', 'card');
                    updatePhantomHeight();
                    onScroll();
                } else {
                    setState('isTimeView', false);
                    setState('isCardView', false);
                    saveSetting('viewMode', 'folder');
                    setState('isSearching', false);
                    navigateTo(state.currentFolderId, state.navigationStack[state.navigationStack.length-1]?.title || t("crumbHome"));
                }
            }
        });
    });

    darkModeSwitch.addEventListener('change', (e) => {
        toggleDarkMode(e.target.checked);
        saveSetting('darkMode', e.target.checked);
    });

    languageSelect.addEventListener('change', (e) => {
        setLanguage(e.target.value);
        saveSetting('language', e.target.value);
        applyTranslations();
        refreshCurrentView();
    });

    btnScrollTop.addEventListener('click', () => {
        listContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });

    btnScrollBottom.addEventListener('click', () => {
        listContainer.scrollTo({ top: listContainer.scrollHeight, behavior: 'smooth' });
    });

    document.addEventListener('click', (e) => {
        if (!settingsCard.classList.contains('hidden')) {
            if (!settingsCard.contains(e.target) && !btnSettings.contains(e.target)) {
                toggleSettings(false);
            }
        }
    });

    setupModals();

    // Dummy onScroll to match original structure
    function onScroll() {
        requestAnimationFrame(renderVisibleItems);
    }
}
