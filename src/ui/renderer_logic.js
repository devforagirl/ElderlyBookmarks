import { t, setLanguage } from '../core/i18n.js';
import { BookmarkService } from '../services/bookmark.js';
import { safeAPI, showError } from '../utils/helpers.js';
import { state, setState } from '../core/state.js';
import { VirtualList } from './components/List.js';
import { createRow, createCard, createHeaderRow } from './renderers.js';

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

    // Virtual List Setup
    const virtualList = new VirtualList(listContainer, {
        rowHeight: currentRowHeight,
        onHeaderFound: (headerTitle) => {
            const labelEl = document.getElementById('time-view-label');
            const sepEl = document.getElementById('time-view-separator');
            if (labelEl && sepEl) {
                if (headerTitle) {
                    labelEl.textContent = headerTitle;
                    sepEl.style.display = 'inline';
                } else {
                    labelEl.textContent = '';
                    sepEl.style.display = 'none';
                }
            }
        },
        renderItem: (item, index, height) => {
            if (item.type === 'header') {
                return createHeaderRow(item, index, height);
            }
            
            const handlers = {
                onClick: (item) => handleItemClick(item),
                onEdit: (item) => openEditModal(item),
                onDelete: (item) => openDeleteModal(item)
            };

            if (state.isCardView) {
                return createCard(item, index, height, getColumns(), listContainer.clientWidth, handlers);
            }
            return createRow(item, index, height, handlers);
        }
    });

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
        renderVisibleItems();
    }

    async function toggleSearch(show) {
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
            renderVisibleItems();

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

    function renderVisibleItems() {
        virtualList.update(state.allItems, {
            isCardView: state.isCardView,
            cols: getColumns(),
            emptyText: t("msgEmpty")
        });
    }

    function handleItemClick(item) {
        if (item.url) {
            chrome.tabs.create({ url: item.url });
        } else {
            navigateTo(item.id, item.title);
        }
    }

    function openEditModal(item) {
        targetItemForAction = item;
        editTitleInput.value = item.title;
        editUrlInput.value = item.url || '';
        modalEdit.classList.remove('hidden');
    }

    function openDeleteModal(item) {
        targetItemForAction = item;
        modalDeleteText.textContent = t("msgDeleteConfirm").replace('$TITLE$', item.title);
        modalDelete.classList.remove('hidden');
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
            renderVisibleItems();
            listContainer.scrollTop = savedScrollTop;
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
        renderVisibleItems();
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
                    renderVisibleItems();
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
