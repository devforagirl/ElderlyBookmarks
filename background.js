chrome.action.onClicked.addListener(async (tab) => {
  // tab.windowId tells us which window was active when clicked
  const currentWindowId = tab.windowId;
  const url = chrome.runtime.getURL('main.html');
  
  // Query tabs in the SPECIFIC window where the icon was clicked
  const tabs = await chrome.tabs.query({ windowId: currentWindowId });
  const targetTab = tabs.find(t => t.url && t.url.startsWith(url));

  if (targetTab) {
    // If found in this window, close it
    chrome.tabs.remove(targetTab.id);
  } else {
    // If not found, create a new one in THIS window
    chrome.tabs.create({ 
      url: 'main.html',
      windowId: currentWindowId 
    });
  }
});
