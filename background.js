const MAX_HISTORY_SIZE = 20;
const DEBOUNCE_DELAY_MS = 100;

// Store tab browsing history, now storing a simplified object
let tabHistory = []; 
let cycleSet = []; // The set of tabs we are currently cycling through.
let activationTimer; // Timer for debouncing tab activation

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateTabHistoryCount') {
    // This action doesn't require complex logic anymore, but we keep the listener
    // in case we want to add instant feedback or validation in the future.
    console.log(`Tab history count updated to: ${message.count}`);
    sendResponse({success: true});
    return true; // Keep listener alive for async response
  
  } else if (message.action === 'updateShortcut') {
    const shortcutStr = message.shortcut.keys.join('+');
    console.log('[background] Received shortcut update check for:', shortcutStr);

    chrome.commands.getAll(async (commands) => {
      // Check if the requested shortcut is in use by any command (including this extension's)
      const isShortcutInUse = commands.some(command => {
        // We only care about shortcuts that are actively defined
        if (!command.shortcut) return false;
        // Normalize and compare
        const normalizedExisting = command.shortcut.replace(/\s/g, '').toLowerCase();
        const normalizedNew = shortcutStr.replace(/\s/g, '').toLowerCase();
        return normalizedExisting === normalizedNew;
      });

      if (isShortcutInUse) {
        // Let the popup know the shortcut is taken
        sendResponse({ status: 'in_use', shortcut: shortcutStr });
      } else {
        // Let the popup know the shortcut is available to be set manually
        sendResponse({ status: 'available' });
      }
    });
    
    return true; // Indicates an async response.
  }
  // The 'getSettings' and 'getCommands' listeners have been removed as they are no longer used by the popup.
});

// Listen for tab activation events to record history
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  clearTimeout(activationTimer);
  activationTimer = setTimeout(async () => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (!isSwitchableTab(tab)) {
          return;
      }

      // Remove the tab if it already exists in history to move it to the end
      tabHistory = tabHistory.filter(t => t.id !== tab.id);

      // Store a simplified object with only necessary info
      tabHistory.push({
        id: tab.id,
        windowId: tab.windowId,
        title: tab.title,
      });
    
      if (tabHistory.length > MAX_HISTORY_SIZE) {
        tabHistory.shift(); // Keep history size manageable
      }
    } catch (e) {
        console.warn(`Could not get tab info for tabId: ${activeInfo.tabId}. It might have been closed.`, e);
    }
  }, DEBOUNCE_DELAY_MS);
});

// Listen for tab removal events to clean up history
chrome.tabs.onRemoved.addListener((tabId) => {
  tabHistory = tabHistory.filter(t => t.id !== tabId);
  cycleSet = cycleSet.filter(t => t.id !== tabId); // Also remove from active cycle
});

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[background] onCommand:', command);
  if (command === "open-last-tab") {
    await openLastVisitedTab();
  }
});

function isSwitchableTab(tab) {
  // Allow all tabs, including special pages like devtools, as long as they exist.
  return tab && tab.id;
}

// Switch to the previously visited tab
async function openLastVisitedTab() {
  console.log('[background] openLastVisitedTab called');
  
  if (tabHistory.length === 0) {
    console.log('[background] Tab history is empty, re-initializing...');
    await initializeTabHistory();
  }

  const settings = await chrome.storage.sync.get({ tabHistoryCount: 2 });
  const tabHistoryCount = settings.tabHistoryCount;
  
  console.log('[background] tabHistoryCount:', tabHistoryCount, 'tabHistory:', tabHistory.map(t=>({id: t.id, title: t.title})));
  
  // Create a validated list of switchable tabs from history
  const validTabHistory = [];
  for (const t of tabHistory) {
      try {
          // Verify tab still exists. This is a quick check.
          await chrome.tabs.get(t.id);
          validTabHistory.push(t);
      } catch (e) {
          // Tab has been closed, onRemoved listener should have caught it, but this is a safeguard.
      }
  }
  tabHistory = validTabHistory; // Update main history to remove closed tabs

  if (tabHistory.length < 2) {
    console.log('[background] Not enough tabs in history to switch.');
    return;
  }

  const currentTab = tabHistory[tabHistory.length - 1];
    
  // Reset the cycle if:
  // 1. The user navigated to a tab outside the current cycle.
  // 2. The number of tabs to cycle has changed.
  if (cycleSet.length > 0) {
    const isTabInCycle = cycleSet.find(t => t.id === currentTab.id);
    const expectedCycleSize = Math.min(tabHistoryCount, validTabHistory.length);
    const isSizeCorrect = cycleSet.length === expectedCycleSize;
    if (!isTabInCycle || !isSizeCorrect) {
        console.log(`[background] Resetting cycle. Reason: ${!isTabInCycle ? 'Tab not in cycle' : `Cycle size changed. Expected: ${expectedCycleSize}, Got: ${cycleSet.length}`}.`);
        cycleSet = [];
    }
  }

  // If no cycle is active, create one from the latest history.
  if (cycleSet.length === 0) {
      // Create a cycle with the correct number of tabs.
      // It should be the smaller of the user's preference and the actual number of available tabs.
      const cycleSize = Math.min(tabHistoryCount, validTabHistory.length);
      cycleSet = validTabHistory.slice(-cycleSize);
      console.log("[background] Created new cycleSet:", cycleSet.map(t=>({id: t.id, title: t.title})));
  }
  
  let nextTab;
  const currentIndex = cycleSet.findIndex(t => t.id === currentTab.id);
  
  if (currentIndex !== -1) {
    const nextIndex = (currentIndex - 1 + cycleSet.length) % cycleSet.length;
    nextTab = cycleSet[nextIndex];
  } else {
    // Fallback: This can happen on the very first switch.
    // Choose the tab before the current one in the newly created cycle.
    nextTab = cycleSet[cycleSet.length - 2];
  }
  
  if (!nextTab || nextTab.id === currentTab.id) {
    // If there's still no valid next tab, or it's the same as the current one (e.g., only 2 tabs in cycle)
    // and we're on the "older" one, let's ensure we switch to the other one.
    const otherTab = cycleSet.find(t => t.id !== currentTab.id);
    if(otherTab) nextTab = otherTab;
  }

  if (!nextTab) {
    console.log('[background] Could not determine nextTab.');
    return;
  }
  
  try {
    console.log(`[background] Attempting switch. Current: tab=${currentTab.id} ('${currentTab.title}'), window=${currentTab.windowId}. Next: tab=${nextTab.id} ('${nextTab.title}'), window=${nextTab.windowId}`);
    
    const targetTabInfo = await chrome.tabs.get(nextTab.id);

    if (targetTabInfo.groupId && targetTabInfo.groupId > -1) {
        console.log(`[background] Tab ${nextTab.id} is in group ${targetTabInfo.groupId}. Checking group state.`);
        const group = await chrome.tabGroups.get(targetTabInfo.groupId);
        if (group.collapsed) {
            console.log(`[background] Group ${group.id} is collapsed. Expanding it.`);
            await chrome.tabGroups.update(group.id, { collapsed: false });
        }
    }
    
    console.log(`[background] Activating tab ${nextTab.id}...`);
    await chrome.tabs.update(nextTab.id, { active: true });
    console.log(`[background] Tab ${nextTab.id} activated.`);
    
    const { license_key } = await chrome.storage.sync.get('license_key');
    const isPremium = !!license_key;

    const windowToFocus = await chrome.windows.get(nextTab.windowId);
    console.log(`[background] Target window ${nextTab.windowId} current state: ${windowToFocus.state}`);
    
    const updateState = { focused: true };
    
    if (windowToFocus.state === 'minimized') {
      updateState.state = 'normal';
      console.log(`[background] Target window is minimized. Setting state to 'normal'.`);
    }
    
    const isCrossWindow = nextTab.windowId !== currentTab.windowId;

    if (isCrossWindow) {
      if (isPremium) {
        // Premium user: Perform the cross-window switch
        updateState.drawAttention = true;
        console.log(`[background] Premium user: Performing cross-window switch to ${nextTab.windowId}`);
        await chrome.windows.update(nextTab.windowId, updateState);
      } else {
        // Free user: Do not bring the window to the front
        console.log(`[background] Free user: Cross-window switch to ${nextTab.windowId} is a premium feature. Please upgrade.`);
      }
    } else {
      // Same-window switch, always allowed for all users.
      console.log(`[background] Performing same-window switch in ${nextTab.windowId}`);
      await chrome.windows.update(nextTab.windowId, updateState);
    }
    
    // Manually update the history to reflect the switch, as the onActivated event can be unreliable for programmatic changes.
    tabHistory = tabHistory.filter(t => t.id !== nextTab.id);
    tabHistory.push(nextTab);
    console.log('[background] Manually updated tab history. New history:', tabHistory.map(t => ({id: t.id, title: t.title})));

  } catch (error) {
    console.error(`Error switching to tab ${nextTab.id}:`, error);
    // If switching failed, remove the tab from history as it's likely closed.
    tabHistory = tabHistory.filter(t => t.id !== nextTab.id);
    cycleSet = cycleSet.filter(t => t.id !== nextTab.id);
  }
}

// Initializing the extension state on startup
async function initializeExtension() {
  console.log("Initializing Extension...");
  await initializeTabHistory();
}

// Populate the initial tab history
async function initializeTabHistory() {
  try {
    const allTabs = await chrome.tabs.query({});
    const switchableTabs = allTabs.filter(isSwitchableTab);
    
    // Sort by last accessed time to get the correct chronological order.
    // Ascending order means oldest tabs are first, most recent is last. This
    // matches the behavior of the onActivated listener, which adds new tabs to the end.
    switchableTabs.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));

    // Map to our simplified format and keep only the most recent ones.
    tabHistory = switchableTabs.map(tab => ({
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title,
    })).slice(-MAX_HISTORY_SIZE);

    console.log("Initialized tab history:", tabHistory.map(t=>({id: t.id, title: t.title})));
  } catch (error) {
    console.error("Error initializing tab history:", error);
  }
}

// Initialize on install or startup
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);


// Helper functions for debugging, can be removed in production
async function logTabHistoryWithTitles(tabHistory) {
  if (!tabHistory || tabHistory.length === 0) {
    console.log("Tab history is empty.");
    return;
  }
  const historyWithTitles = await Promise.all(
    tabHistory.map(async (t) => {
      try {
        const tab = await chrome.tabs.get(t.id);
        return { id: t.id, title: tab.title };
      } catch (e) {
        return { id: t.id, title: "Tab not found" };
      }
    })
  );
  console.log("Tab History:", historyWithTitles);
}

async function logTabsToCycleWithTitles(tabsToCycle) {
  if (!tabsToCycle || tabsToCycle.length === 0) {
    console.log("Cycle set is empty.");
    return;
  }
  const cycleWithTitles = await Promise.all(
    tabsToCycle.map(async (t) => {
      try {
        const tab = await chrome.tabs.get(t.id);
        return { id: t.id, title: tab.title };
      } catch (e) {
        return { id: t.id, title: "Tab not found" };
      }
    })
  );
  console.log("Cycle Set:", cycleWithTitles);
}