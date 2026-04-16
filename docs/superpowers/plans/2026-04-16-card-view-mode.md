# Card View Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a minimalist, high-accessibility "Card View" for bookmarks, featuring large text, no icons, and a grid layout.

**Architecture:** 
- **Layout:** Transition from a 1D virtual list (rows) to a 2D virtual grid. The number of columns is dynamically calculated based on the container width (min 250px per card).
- **Rendering:** Map the linear `allItems` index to `(row, col)` coordinates to maintain virtual scrolling performance.
- **Styling:** Use CSS Grid for the layout, with specific background colors to distinguish folders from web bookmarks.

**Tech Stack:** Vanilla JS, CSS, Chrome Bookmarks API.

---

## File Structure

- Modify: `main.html` (Add UI controls for Card View)
- Modify: `style.css` (Add grid layout and `.bookmark-card` styles)
- Modify: `renderer.js` (Update state, virtual list logic, and rendering loop)

---

## Tasks

### Task 1: UI Integration & State Management

**Files:**
- Modify: `main.html`
- Modify: `renderer.js`

- [ ] **Step 1: Add Card Mode radio button to settings**
  In `main.html`, inside the `view-mode` radio group, add:
  ```html
  <label class="radio-label">
      <input type="radio" name="view-mode" value="card">
      <span data-i18n="lblModeCard">Card</span>
  </label>
  ```

- [ ] **Step 2: Initialize `isCardView` state in `renderer.js`**
  Add `let isCardView = false;` to the state section.

- [ ] **Step 3: Update View Mode listener in `renderer.js`**
  Update the `viewModeRadios` listener to handle the `card` value:
  - If `value === 'card'`, set `isCardView = true`, `isTimeView = false`, and save setting.
  - If other values, set `isCardView = false`.

- [ ] **Step 4: Implement setting persistence for `viewMode === 'card'`**
  Update `loadSettings` and `saveSetting` to handle the `card` mode.

- [ ] **Step 5: Commit**

### Task 2: CSS Styling for Card Mode

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Define Card Mode Container styles**
  Add a class `.list-container.card-mode` that uses `display: grid` or relative positioning for virtualized cards. Since we use absolute positioning for virtual lists, we will handle the grid logic in JS, but CSS needs to define the card look.

- [ ] **Step 2: Implement `.bookmark-card` styles**
  - No icons.
  - Text left-aligned.
  - Large padding, bold text.
  - Thick borders (4px).
  - Transition for hover effects.

- [ ] **Step 3: Implement Folder-specific styling**
  Add `.bookmark-card.is-folder` with a distinct background color (e.g., pale yellow).

- [ ] **Step 4: Implement Hover Action Buttons**
  Style `.item-actions` to be hidden by default and visible only on `.bookmark-card:hover`. Position them at the bottom-right.

- [ ] **Step 5: Commit**

### Task 3: Virtual Grid Logic Implementation

**Files:**
- Modify: `renderer.js`

- [ ] **Step 1: Implement Column Calculation**
  Create a function to calculate columns: `cols = Math.floor(listContainer.clientWidth / 250)`.

- [ ] **Step 2: Update `updatePhantomHeight`**
  If `isCardView` is true: `listPhantom.style.height = Math.ceil(allItems.length / cols) * currentRowHeight + 'px'`.

- [ ] **Step 3: Modify `renderVisibleItems` for 2D Mapping**
  - Calculate `startIndex` and `endIndex` as usual.
  - For each item in range:
    - `row = Math.floor(index / cols)`
    - `col = index % cols`
    - `top = row * currentRowHeight`
    - `left = col * (listContainer.clientWidth / cols)`
    - Set these styles on the element.

- [ ] **Step 4: Update `createRow` to `createCard`**
  Create a new function `createCard(item, index)` that returns a div with class `.bookmark-card`. Remove icon logic.

- [ ] **Step 5: Integrate `createCard` into `renderVisibleItems`**
  Use `createCard` when `isCardView` is true.

- [ ] **Step 6: Commit**

### Task 4: Final Polish & Validation

**Files:**
- Modify: `renderer.js`
- Modify: `style.css`

- [ ] **Step 1: Fix text overflow in cards**
  Ensure long titles wrap or truncate elegantly in the card format.

- [ ] **Step 2: Test with various font sizes**
  Verify that cards scale correctly when the font size slider is moved.

- [ ] **Step 3: Test with Timeline View**
  Verify if Card Mode works with Time View (Section headers should span full width).

- [ ] **Step 4: Commit**
