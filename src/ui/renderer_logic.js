import { t, setLanguage } from '../core/i18n.js';
import { BookmarkService } from '../services/bookmark.js';
import { safeAPI, showError } from '../utils/helpers.js';
import { state, setState } from '../core/state.js';
import { createRow, createCard, createHeaderRow } from './renderers.js';

const DEFAULT_FONT_SIZE = 22;
const PAGE_SIZE = 50;

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
    
    const cardColsSelect = document.getElementById('card-cols-select');
    const cardColsRow = document.getElementById('card-cols-row');
    const btnLoadMore = document.getElementById('btn-load-more');

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
    const btnEditDelete = document.getElementById('btn-edit-delete');

    let targetItemForAction = null;
    let loadedOffset = 0;

    // --- INTERNAL HELPERS ---
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async function getFolderPath(folderId) {
        const path = [];
        let currentId = folderId;

        while (currentId !== '0') {
            try {
                const folder = await safeAPI(chrome.bookmarks.get, currentId);
                path.unshift({ id: currentId, title: folder.title || t("crumbHome") });

                if (folder.parentId === undefined || folder.parentId === currentId) break;
                currentId = folder.parentId;
            } catch (err) {
                break;
            }
        }

        // Always start with Root
        path.unshift({ id: '0', title: t("crumbHome") });
        return path;
    }

    function loadSettings() {
        const savedFontSize = localStorage.getItem('setting_fontSize');
        const savedViewMode = localStorage.getItem('setting_viewMode');
        const savedDarkMode = localStorage.getItem('setting_darkMode');
        const savedLanguage = localStorage.getItem('setting_language');
        const savedCardCols = localStorage.getItem('setting_cardCols');

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
        
        if (savedCardCols) {
            cardColsSelect.value = savedCardCols;
            setState('cardCols', parseInt(savedCardCols, 10));
        } else {
            setState('cardCols', 3);
        }
        updateCardLayout();

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
        document.documentElement.style.setProperty('--font-base', `${size}px`);
        fontSizeDisplay.textContent = `${size}px`;
        // Use a a clean render for size changes
        renderItemsBatch(state.allItems, true);
    }

    function updateCardLayout() {
        const cols = state.cardCols || 3;
        document.documentElement.style.setProperty('--card-cols', cols);
        
        if (state.isCardView) {
            cardColsRow.classList.remove('hidden');
            listContainer.classList.add('card-view-active');
        } else {
            cardColsRow.classList.add('hidden');
            listContainer.classList.remove('card-view-active');
        }
    }

    async function hardReset() {
        updateCardLayout();
        loadedOffset = 0;
        setState('allItems', []);

        // Targeted cleanup instead of innerHTML = '' to avoid flickering
        const itemsToClear = listContainer.querySelectorAll('.list-item, .section-header, .bookmark-card, .empty-state');
        itemsToClear.forEach(el => el.remove());

        // Ensure core components are present
        if (!document.getElementById('list-phantom')) {
            listContainer.appendChild(listPhantom);
        }

        let loadMoreBtn = document.getElementById('btn-load-more');
        if (!loadMoreBtn) {
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'btn-load-more';
            loadMoreBtn.className = 'text-btn';
            loadMoreBtn.style.cssText = 'display: block; margin: 20px auto; width: 200px; text-align: center; font-size: 24px;';
            loadMoreBtn.textContent = t("btnLoadMore");
            loadMoreBtn.onclick = () => loadPage(true);
            listContainer.appendChild(loadMoreBtn);
        }

        await loadPage(false);
    }

    async function loadPage(append = false) {
        if (!append) {
            // The hardReset already handles the DOM clearing and offset reset.
            // But if loadPage(false) is called directly, we do it here.
            loadedOffset = 0;
            setState('allItems', []);
            listContainer.innerHTML = '';
            listContainer.appendChild(listPhantom);
            
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'btn-load-more';
            loadMoreBtn.className = 'text-btn';
            loadMoreBtn.style.cssText = 'display: block; margin: 20px auto; width: 200px; text-align: center; font-size: 24px;';
            loadMoreBtn.textContent = t("btnLoadMore");
            loadMoreBtn.onclick = () => loadPage(true);
            listContainer.appendChild(loadMoreBtn);
        }

        try {
            let items = [];
            if (state.isSearching) {
                items = await BookmarkService.search(searchInput.value.toLowerCase(), loadedOffset, PAGE_SIZE);
            } else if (state.isTimeView) {
                // Timeline mode: Load everything but we only render slices
                const fullTree = await BookmarkService.getTree();
                const flat = BookmarkService.flattenTree(fullTree);
                flat.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
                items = BookmarkService.groupBookmarksByTime(flat, t);
                
                // Set allItems to the full list for Timeline
                setState('allItems', items);
                
                // Timeline logic: a loadPage(true) just increases offset
                if (append) {
                    loadedOffset += PAGE_SIZE;
                } else {
                    loadedOffset = 0;
                }
                
                // Render only the current slice
                renderItemsBatch(items.slice(loadedOffset, loadedOffset + PAGE_SIZE), append);
                
                const currentBtn = document.getElementById('btn-load-more');
                if (currentBtn) {
                    currentBtn.style.display = (loadedOffset + PAGE_SIZE < items.length) ? 'block' : 'none';
                }
                return;
            } else {
                items = await BookmarkService.getChildren(state.currentFolderId, loadedOffset, PAGE_SIZE);
            }

            if (items.length === 0) {
                if (!append) {
                    const empty = document.createElement('div');
                    empty.className = 'empty-state';
                    empty.textContent = t("msgEmpty");
                    listContainer.appendChild(empty);
                }
                const currentBtn = document.getElementById('btn-load-more');
                if (currentBtn) currentBtn.style.display = 'none';
                return;
            }

            setState('allItems', [...state.allItems, ...items]);
            loadedOffset += items.length;
            
            const currentBtn = document.getElementById('btn-load-more');
            if (currentBtn) {
                currentBtn.style.display = items.length < PAGE_SIZE ? 'none' : 'block';
            }

            renderItemsBatch(items, append);
        } catch (err) {
            showError(t("msgErrLoadFolder") + err);
        }
    }

    function renderItemsBatch(items, clear = false) {
        if (clear) {
            const itemsToClear = listContainer.querySelectorAll('.list-item, .section-header, .bookmark-card, .empty-state');
            itemsToClear.forEach(el => el.remove());
        }

        const handlers = {
            onClick: (item) => handleItemClick(item),
            onEdit: (item) => openEditModal(item),
            onDelete: (item) => openDeleteModal(item)
        };

        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            let el;
            if (item.type === 'header') {
                el = createHeaderRow(item, 0, 0);
            } else if (state.isCardView) {
                el = createCard(item, 0, 0, 0, 0, handlers);
            } else {
                el = createRow(item, 0, 0, handlers);
            }
            if (el) {
                fragment.appendChild(el);
            }
        });

        const btn = document.getElementById('btn-load-more');
        if (btn) {
            listContainer.insertBefore(fragment, btn);
        } else {
            listContainer.appendChild(fragment);
        }
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
        saveSetting('lastFolderId', folderId);

        // Resolve title if not provided (e.g. from hashchange)
        let finalTitle = title;
        if (finalTitle === null) {
            try {
                const folder = await safeAPI(chrome.bookmarks.get, folderId);
                finalTitle = folder.title || t("crumbHome");
            } catch (err) {
                finalTitle = t("crumbHome");
            }
        }

        const index = state.navigationStack.findIndex(item => item.id === folderId);
        if (index !== -1) {
            setState('navigationStack', state.navigationStack.slice(0, index + 1));
        } else {
            setState('navigationStack', [...state.navigationStack, { id: folderId, title: finalTitle }]);
        }

        updateBreadcrumbs();
        await hardReset();

        // Sync to URL hash to support back button
        if (window.location.hash !== '#' + folderId) {
            window.location.hash = folderId;
        }
    }

    async function enterTimeView() {
        setState('isTimeView', true);
        setState('isCardView', false);
        saveSetting('viewMode', 'time');
        
        breadcrumbsContainer.innerHTML = `
            <span class="crumb" style="cursor:default">${t("crumbTimeView")}</span>
            <span class="crumb-separator" id="time-view-separator" style="display:none">></span>
            <span class="crumb" id="time-view-label" style="cursor:default; color: var(--folder-icon-color);"></span>
        `;

        await hardReset();
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
        await hardReset();
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
        btnEditDelete.onclick = () => {
            modalEdit.classList.add('hidden');
            openDeleteModal(targetItemForAction);
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
        await hardReset();
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

    // Route handling: check for initial hash
    const initialHash = window.location.hash.substring(1);
    if (initialHash && !state.isTimeView) {
        await navigateTo(initialHash, null);
    } else if (state.isTimeView) {
        await enterTimeView();
    } else {
        // Fallback to last visited folder or root
        const lastFolderId = localStorage.getItem('setting_lastFolderId');

        if (lastFolderId && lastFolderId !== '0') {
            try {
                // Verify folder still exists
                await safeAPI(chrome.bookmarks.get, lastFolderId);

                // Rebuild full navigation path to restore breadcrumbs
                const fullPath = await getFolderPath(lastFolderId);
                setState('navigationStack', fullPath);

                // Now navigate to the leaf folder to load items
                const leaf = fullPath[fullPath.length - 1];
                await navigateTo(leaf.id, leaf.title);
            } catch (err) {
                // Folder deleted, fallback to root
                await navigateTo('0', t("crumbHome"));
            }
        } else {
            await navigateTo('0', t("crumbHome"));
        }
    }

    window.addEventListener('hashchange', async () => {
        const folderId = window.location.hash.substring(1);
        if (folderId && !state.isTimeView) {
            await navigateTo(folderId, null);
        }
    });

    // Remove redundant resize re-render as layout is handled by CSS Grid and --card-cols
    window.addEventListener('resize', () => {
        updateCardLayout();
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

    cardColsSelect.addEventListener('change', (e) => {
        const cols = parseInt(e.target.value, 10);
        setState('cardCols', cols);
        saveSetting('cardCols', cols);
        hardReset();
    });

    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (e.target.value === 'time') {
                    setState('isTimeView', true);
                    setState('isCardView', false);
                    saveSetting('viewMode', 'time');
                    updateCardLayout(); // Explicitly sync layout
                    enterTimeView();
                } else if (e.target.value === 'card') {
                    setState('isCardView', true);
                    setState('isTimeView', false);
                    saveSetting('viewMode', 'card');
                    updateCardLayout();
                    hardReset();
                } else {
                    setState('isTimeView', false);
                    setState('isCardView', false);
                    saveSetting('viewMode', 'folder');
                    updateCardLayout(); // Explicitly sync layout
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
        hardReset();
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
}
