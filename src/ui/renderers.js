import { t } from '../core/i18n.js';

/**
 * Pure UI Renderers
 * These functions take data and callbacks, and return a DOM element.
 */

export function createHeaderRow(item, index, rowHeight) {
    const div = document.createElement('div');
    div.className = 'section-header';
    div.textContent = item.title;
    return div;
}

export function createCard(item, index, rowHeight, cols, containerWidth, handlers) {
    const div = document.createElement('div');
    div.className = 'bookmark-card';
    if (!item.url) div.classList.add('is-folder');
    
    // Content fallback: Title -> URL -> Untitled
    const displayText = item.title || item.url || t("msgUntitled");
    
    const textDiv = document.createElement('div');
    textDiv.className = 'card-text';
    textDiv.textContent = displayText;
    div.appendChild(textDiv);
    
    // Top-right Modify button
    const btnModify = document.createElement('button');
    btnModify.className = 'btn-modify';
    btnModify.textContent = t("btnLabelEdit");
    btnModify.onclick = (e) => {
        e.stopPropagation();
        handlers.onEdit(item);
    };
    div.appendChild(btnModify);
    
    div.onclick = () => handlers.onClick(item);
    
    return div;
}

export function createRow(item, index, rowHeight, handlers) {
    const div = document.createElement('div');
    div.className = 'list-item';
    
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
        handlers.onEdit(item);
    };
    
    const btnDelete = document.createElement('button');
    btnDelete.className = 'action-btn btn-delete';
    btnDelete.textContent = t("modalDeleteTitle");
    btnDelete.onclick = (e) => {
        e.stopPropagation();
        handlers.onDelete(item);
    };
    
    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDelete);
    
    div.appendChild(iconDiv);
    div.appendChild(textDiv);
    div.appendChild(actionsDiv);
    
    div.onclick = () => handlers.onClick(item);
    
    return div;
}
