import { t } from '../core/i18n.js';

/**
 * Pure UI Renderers
 * These functions take data and callbacks, and return a DOM element.
 */

export function createHeaderRow(item, index, rowHeight) {
    const div = document.createElement('div');
    div.className = 'section-header';
    div.style.top = `${index * rowHeight}px`;
    div.textContent = item.title;
    return div;
}

export function createCard(item, index, rowHeight, cols, containerWidth, handlers) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cardWidth = Math.max(100, containerWidth / cols);
    
    const div = document.createElement('div');
    div.className = 'bookmark-card';
    if (!item.url) div.classList.add('is-folder');
    
    div.style.top = `${row * rowHeight}px`;
    div.style.left = `${col * cardWidth}px`;
    div.style.width = `${cardWidth - 20}px`;
    div.style.height = `${rowHeight - 20}px`;
    
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
        handlers.onEdit(item);
    };
    
    const btnDelete = document.createElement('button');
    btnDelete.className = 'action-btn btn-delete';
    btnDelete.textContent = t("btnLabelDelete");
    btnDelete.onclick = (e) => {
        e.stopPropagation();
        handlers.onDelete(item);
    };
    
    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDelete);
    div.appendChild(actionsDiv);
    
    div.onclick = () => handlers.onClick(item);
    
    return div;
}

export function createRow(item, index, rowHeight, handlers) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.style.top = `${index * rowHeight}px`;
    
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
    btnDelete.textContent = t("btnLabelDelete");
    btnDelete.title = t("modalDeleteTitle");
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
