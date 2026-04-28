import { safeAPI } from '../utils/helpers.js';

/**
 * Service for handling Chrome Bookmarks API calls and data transformations
 */
export const BookmarkService = {
    /**
     * Gets children of a specific folder with pagination
     */
    async getChildren(folderId, offset = 0, limit = 50) {
        const allChildren = await safeAPI(chrome.bookmarks.getChildren, folderId);
        return allChildren.slice(offset, offset + limit);
    },

    /**
     * Gets the entire bookmark tree
     */
    async getTree() {
        return safeAPI(chrome.bookmarks.getTree);
    },

    /**
     * Searches bookmarks based on a query with pagination
     */
    async search(query, offset = 0, limit = 50) {
        const allResults = await safeAPI(chrome.bookmarks.search, query);
        return allResults.slice(offset, offset + limit);
    },

    /**
     * Removes a bookmark or a whole tree
     */
    async remove(id, isTree = false) {
        return isTree 
            ? safeAPI(chrome.bookmarks.removeTree, id) 
            : safeAPI(chrome.bookmarks.remove, id);
    },

    /**
     * Updates a bookmark's properties
     */
    async update(id, updates) {
        return safeAPI(chrome.bookmarks.update, id, updates);
    },

    /**
     * Flattens a bookmark tree into a simple list of bookmark items
     */
    flattenTree(nodes, result = []) {
        for (const node of nodes) {
            if (node.url) {
                result.push(node);
            }
            if (node.children) {
                this.flattenTree(node.children, result);
            }
        }
        return result;
    },

    /**
     * Groups a list of bookmarks by their addition date
     * @param {Array} bookmarks - Sorted bookmarks (descending)
     * @param {Function} translateFn - Translation function to get group headers
     */
    groupBookmarksByTime(bookmarks, translateFn) {
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

            if (date >= today) group = translateFn("groupToday");
            else if (date >= weekAgo) group = translateFn("groupWeek");
            else if (date >= monthAgo) group = translateFn("groupMonth");
            else if (date >= threeMonthsAgo) group = translateFn("group3Months");
            else if (date >= sixMonthsAgo) group = translateFn("group6Months");
            else if (date >= thisYearStart) group = translateFn("groupYear");
            else group = translateFn("groupEarlier");

            if (group === translateFn("groupEarlier")) {
                const bYear = new Date(date).getFullYear();
                if (bYear < now.getFullYear()) {
                    group = `${bYear}${translateFn("yearSuffix")}`;
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
};
