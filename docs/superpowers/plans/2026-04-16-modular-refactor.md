# 项目模块化重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单体 `renderer.js` 重构为基于 ES Modules 的模块化架构，提升代码可维护性、可测试性和扩展性。

**Architecture:** 采用“渐进式抽离”策略。先建立基础设施 $ightarrow$ 抽离通用工具 $ightarrow$ 抽离数据服务 $ightarrow$ 抽离状态管理 $ightarrow$ 抽离 UI 组件 $ightarrow$ 最后清理入口文件。

**Tech Stack:** 原生 ES Modules (ESM), Chrome Extensions API.

---

## 📂 文件映射图

| 目标文件 | 职责 | 状态 |
| :--- | :--- | :--- |
| `src/utils/helpers.js` | 存放 `safeAPI` 和通用工具函数 | 新建 |
| `src/core/i18n.js` | 统一翻译管理，接管 `locales.js` 的数据 | 新建 |
| `src/services/bookmark.js` | 封装 `chrome.bookmarks` API，处理数据分组与转换 | 新建 |
| `src/core/state.js` | 集中管理 UI 状态 (currentFolder, items, 等) | 新建 |
| `src/ui/renderers.js` | 纯 UI 渲染函数 (`createRow`, `createCard`) | 新建 |
| `src/ui/components/List.js` | 虚拟列表通用控制器 (计算偏移、可见项) | 新建 |
| `src/main.js` | 程序入口，初始化模块并协调通信 | 新建 |
| `main.html` | 更新脚本加载方式为 `type="module"` | 修改 |
| `renderer.js` | 逐步被抽离，最终删除 | 修改 $ightarrow$ 删除 |

---

## 🛠 实施步骤

### Task 1: 基础目录与通用工具抽离
**目标：** 建立 `src` 结构并迁移 `safeAPI` 等工具函数。

- [ ] **Step 1.1: 创建目录结构**
  创建 `src/core`, `src/services`, `src/ui/components`, `src/utils` 文件夹。

- [ ] **Step 1.2: 迁移 `safeAPI` 到 `src/utils/helpers.js`**
  从 `renderer.js` 提取 `safeAPI` 函数及其依赖的 `showError`。
  ```javascript
  // src/utils/helpers.js
  export async function safeAPI(apiCall) {
    try {
      return await apiCall();
    } catch (error) {
      console.error('API Error:', error);
      showError(error.message);
      return null;
    }
  }
  export function showError(msg) {
    // 现有的 showError 实现
  }
  ```

- [ ] **Step 1.3: 在 `renderer.js` 中临时保留 `safeAPI` 但通过导入调用 (可选，若尚未启用 ESM)**
  *注：由于此时还未修改 main.html，我们将先在 src 中写好，在 Task 4 统一切换到 ESM 模式。*

- [ ] **Step 1.4: 提交代码**
  `git add src/ utils/`
  `git commit -m "refactor: extract general helpers to src/utils"`

---

### Task 2: 国际化系统统一
**目标：** 将 `locales.js` 整合进 `src/core/i18n.js`，消除冗余。

- [ ] **Step 2.1: 创建 `src/core/i18n.js`**
  将 `locales.js` 中的 `LOCALES` 对象移入，并提供 `t(key)` 翻译函数。
  ```javascript
  import { LOCALES } from './locales_data.js'; // 建议将数据单独分出
  let currentLang = 'en'; 
  export function setLanguage(lang) { currentLang = lang; }
  export function t(key) {
    return LOCALES[currentLang][key] || key;
  }
  ```

- [ ] **Step 2.2: 迁移翻译调用点**
  将 `renderer.js` 中所有 `LOCALES[lang][key]` 的直接访问改为调用 `t(key)`。

- [ ] **Step 2.3: 验证翻译功能**
  打开插件界面，切换语言，验证所有文本是否正确显示。

- [ ] **Step 2.4: 提交代码**
  `git commit -m "refactor: unify i18n system in src/core/i18n.js"`

---

### Task 3: 书签数据服务抽离
**目标：** 将所有 `chrome.bookmarks` 交互封装在 `src/services/bookmark.js` 中。

- [ ] **Step 3.1: 创建 `src/services/bookmark.js`**
  封装所有书签操作。
  ```javascript
  import { safeAPI } from '../utils/helpers.js';
  export async function getBookmarks(folderId) {
    return safeAPI(() => chrome.bookmarks.getChildren(folderId));
  }
  export function formatBookmarkItems(items) {
    // 将原始 API 数据转换为 UI 需要的标准格式 (处理分组, 时间轴等)
    return items;
  }
  ```

- [ ] **Step 3.2: 将 `renderer.js` 中的数据获取逻辑替换为服务调用**
  例如将 `chrome.bookmarks.getChildren` 替换为 `getBookmarks()`。

- [ ] **Step 3.3: 验证数据加载**
  验证进入文件夹、搜索书签等功能是否依然正常。

- [ ] **Step 3.4: 提交代码**
  `git commit -m "refactor: extract bookmark service to src/services/bookmark.js"`

---

### Task 4: 启用 ES Modules 与状态管理
**目标：** 彻底切换到 ESM，并建立集中状态管理。

- [ ] **Step 4.1: 修改 `main.html` 脚本加载**
  将 `<script src="renderer.js"></script>` 改为 `<script type="module" src="src/main.js"></script>`。

- [ ] **Step 4.2: 创建 `src/core/state.js`**
  建立一个简单的 Store。
  ```javascript
  export const state = {
      currentFolderId: '1',
      allItems: [],
      navigationStack: [],
      viewMode: 'list', // 'list' or 'card'
      searchTerm: ''
  };
  export function setState(key, value) {
      state[key] = value;
      // 这里可以添加简单的 UI 通知机制
  }
  ```

- [ ] **Step 4.3: 迁移 `renderer.js` 的全局变量到 `state.js`**
  所有 `let allItems = ...` 替换为 `state.allItems`。

- [ ] **Step 4.4: 创建 `src/main.js` 入口文件**
  在 `main.js` 中导入所有模块，初始化 UI。
  ```javascript
  import { state } from './core/state.js';
  import { initUI } from './ui/init.js';
  initUI();
  ```

- [ ] **Step 4.5: 验证整体运行**
  确保插件启动后能够正常显示书签列表。

- [ ] **Step 4.6: 提交代码**
  `git commit -m "refactor: enable ESM and implement centralized state management"`

---

### Task 5: UI 渲染逻辑与虚拟列表解耦
**目标：** 将 DOM 创建与列表控制逻辑分离。

- [ ] **Step 5.1: 创建 `src/ui/renderers.js`**
  将 `createRow` 和 `createCard` 移入，使其成为纯函数（接受数据 $ightarrow$ 返回 DOM 元素）。
  ```javascript
  export function createRow(item) {
      // 原有 createRow 代码
      return rowElement;
  }
  ```

- [ ] **Step 5.2: 创建 `src/ui/components/List.js`**
  将虚拟列表计算逻辑（`renderVisibleItems` 等）移入，使其不依赖于具体渲染函数。
  ```javascript
  export class VirtualList {
      constructor(container, renderItem) {
          this.container = container;
          this.container.style.position = 'relative';
          this.renderItem = renderItem;
      }
      update(items) {
          // 虚拟滚动计算逻辑
          // this.renderItem(item);
      }
      // ...
  }
  ```

- [ ] **Step 5.3: 在 `src/main.js` 中组合两者**
  ```javascript
  const list = new VirtualList(document.getElementById('list'), createRow);
  list.update(state.allItems);
  ```

- [ ] **Step 5.4: 验证视图切换与虚拟滚动**
  验证列表视图和卡片视图的切换是否正常，虚拟滚动是否流畅。

- [ ] **Step 5.5: 提交代码**
  `git commit -m "refactor: decouple virtual list from item renderers"`

---

### Task 6: 最终清理与删除 `renderer.js`
**目标：** 删除冗余文件，更新文档。

- [ ] **Step 6.1: 删除 `renderer.js`**
  确认所有逻辑已迁移至 `src/` 目录下。

- [ ] **Step 6.2: 删除 `locales.js`**
  确认 i18n 系统已接管所有翻译。

- [ ] **Step 6.3: 最终全量验证**
  - [ ] 验证进入/退出文件夹
  - [ ] 验证搜索功能
  - [ ] 验证 视图切换 (List/Card)
  - [ ] 验证 语言切换
  - [ ] 验证 虚拟滚动性能
  - [ ] **确认没有任何控制台错误**

- [ ] **Step 6.4: 提交代码**
  `git commit -m "chore: cleanup redundant files and finalize modularization"`

---

## 🧪 验证方案 (Verification Plan)

1.  **功能对等验证**：每一步抽离后，对比重构前后相同操作的预期行为（如：点击文件夹 $ightarrow$ 进入文件夹 $ightarrow$ 列表更新）。
2.  **回归测试清单**：
    *   书签层级导航 (Navigation Stack)
    *   虚拟列表滚动 (Virtual Scrolling)
    *   搜索过滤 (Search filtering)
    *   视图模式切换 (List/Card view)
    *   $	ext{i18n}$ 翻译更新
3.  **性能监控**：使用 Chrome DevTools 检查重构后的 `src/main.js` 是否导致额外的重绘 (Repaints) 或 布局抖动 (Layout Shifts)。

---

## 🚩 风险提示 (Risk Mitigation)
- **ESM 兼容性**：确保 `manifest.json` 的权限设置正确，且所有导入路径使用 `.js` 后缀。
- **DOM 依赖**：在抽离 `VirtualList` 时，注意 `this.container` 的生命周期管理，尽量避免在构造函数中直接操作外部 DOM。
- **Step 4 (ESM 切换)**：这是最具破坏性的步骤。建议在该步骤之前创建临时分支 `refactor/esm-switch` 以便快速回滚。
```