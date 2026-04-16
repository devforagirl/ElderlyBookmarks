/**
 * VirtualList Component
 * Handles the calculation of visible items and manages the phantom height.
 */
export class VirtualList {
    constructor(container, options = {}) {
        this.container = container;
        this.phantom = container.querySelector('#list-phantom') || this._createPhantom();
        this.renderItem = options.renderItem;
        this.rowHeight = options.rowHeight || 80;
        this.bufferSize = options.bufferSize || 5;
        this.onHeaderFound = options.onHeaderFound || (() => {});
    }

    _createPhantom() {
        const p = document.createElement('div');
        p.id = 'list-phantom';
        this.container.appendChild(p);
        return p;
    }

    update(items, context = {}) {
        if (!items || items.length === 0) {
            this.phantom.style.height = '0px';
            this.container.innerHTML = `
                <div id="list-phantom"></div>
                <div class="empty-state">${context.emptyText || 'Empty'}</div>
            `;
            return;
        }

        const { isCardView = false, cols = 1 } = context;
        
        // Update Phantom Height
        if (isCardView) {
            const rows = Math.ceil(items.length / cols);
            this.phantom.style.height = `${rows * this.rowHeight}px`;
        } else {
            this.phantom.style.height = `${items.length * this.rowHeight}px`;
        }

        this._renderVisible(items, isCardView, cols);
    }

    _renderVisible(items, isCardView, cols) {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        
        let startIndex, endIndex;
        if (isCardView) {
            startIndex = Math.floor(scrollTop / this.rowHeight) * cols;
            endIndex = Math.min(
                items.length - 1,
                Math.ceil((scrollTop + viewportHeight) / this.rowHeight) * cols + this.bufferSize
            );
        } else {
            startIndex = Math.floor(scrollTop / this.rowHeight);
            endIndex = Math.min(
                items.length - 1,
                Math.floor((scrollTop + viewportHeight) / this.rowHeight) + this.bufferSize
            );
        }

        // Handle Time View Headers
        if (this.onHeaderFound) {
            let currentHeader = '';
            for (let i = startIndex; i >= 0; i--) {
                if (items[i] && items[i].type === 'header') {
                    currentHeader = items[i].title;
                    break;
                }
            }
            this.onHeaderFound(currentHeader);
        }

        // Clear existing items (keep phantom)
        const itemsToClear = this.container.querySelectorAll('.list-item, .section-header, .empty-state');
        itemsToClear.forEach(el => el.remove());

        // Render visible range
        for (let i = startIndex; i <= endIndex; i++) {
            const item = items[i];
            if (!item) continue;
            
            const el = this.renderItem(item, i, this.rowHeight);
            if (el) {
                this.container.appendChild(el);
            }
        }
    }

    setRowHeight(height) {
        this.rowHeight = height;
    }
}
