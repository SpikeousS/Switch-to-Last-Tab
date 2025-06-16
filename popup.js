document.addEventListener('DOMContentLoaded', async () => {
  let initialSettings = {
    tabHistoryCount: 2,
    customShortcut: { keys: [] }
  };
  let activeShortcut = null; // Cache for the active shortcut

  // Debounce utility function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Get all the DOM elements first
  const saveButton = document.getElementById('save-shortcut');
  const resetButton = document.getElementById('reset-shortcut');
  const successMessage = document.getElementById('success-message');
  const tabCountInput = document.getElementById('tab-history-count');
  const tabCountNote = document.getElementById('tab-count-note');
  const mainkeyError = document.getElementById('mainkey-error');
  const shortcutWarning = document.getElementById('shortcut-warning');
  const shortcutNote = document.getElementById('shortcut-note');
  const modifierSelect = document.getElementById('modifier-select');
  const mainkeyInput = document.getElementById('mainkey-input');

  // Premium feature elements
  const upgradeButton = document.getElementById('upgrade-button');
  const verifyKeyButton = document.getElementById('verify-key-button');
  const licenseKeyInput = document.getElementById('license-key-input');
  const licenseMessage = document.getElementById('license-message');
  const premiumUpsell = document.getElementById('premium-upsell');
  const premiumThanks = document.getElementById('premium-thanks');

  // --- CONFIGURABLE VALUES ---
  // TODO: Replace with your actual Paddle/LemonSqueezy checkout link
  const PADDLE_CHECKOUT_URL = 'https://your-paddle-checkout-link.com'; 
  // This is your Vercel backend URL
  const VERIFICATION_SERVER_URL = 'https://nextjs-boilerplate-sigma-navy-40.vercel.app/api/verify-license'; 

  // Load saved settings and license key from storage
  const data = await chrome.storage.sync.get({
    tabHistoryCount: 2,
    customShortcut: { keys: [] },
    license_key: null,
  });
  
  // Set the initial state from storage
  initialSettings.tabHistoryCount = data.tabHistoryCount;
  initialSettings.customShortcut = data.customShortcut;

  // Set initial values for UI elements based on saved settings
  tabCountInput.value = data.tabHistoryCount;
  let currentKeys = data.customShortcut.keys || [];
  
  if (currentKeys.length > 0) {
    const [mod, key] = currentKeys;
    modifierSelect.value = mod.toLowerCase();
    mainkeyInput.value = key;
  }
  
  // Update license UI based on stored key
  updateLicenseUI(data.license_key);

  function updateLicenseUI(licenseKey) {
    if (licenseKey) {
      premiumUpsell.style.display = 'none';
      premiumThanks.style.display = 'block';
    } else {
      premiumUpsell.style.display = 'block';
      premiumThanks.style.display = 'none';
    }
  }

  upgradeButton.addEventListener('click', () => {
    chrome.tabs.create({ url: PADDLE_CHECKOUT_URL });
  });

  verifyKeyButton.addEventListener('click', async () => {
    const key = licenseKeyInput.value.trim();
    if (!key) {
      licenseMessage.textContent = 'Please enter a license key.';
      licenseMessage.className = 'error';
      return;
    }

    verifyKeyButton.disabled = true;
    verifyKeyButton.textContent = 'Verifying...';
    licenseMessage.textContent = '';

    try {
      // **IMPORTANT**: This is where you call your backend server
      const response = await fetch(VERIFICATION_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ license_key: key }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'valid') {
        // Success! Store the key and update the UI
        await chrome.storage.sync.set({ license_key: key });
        licenseMessage.textContent = 'Successfully activated! Thank you.';
        licenseMessage.className = 'success';
        updateLicenseUI(key);
      } else {
        // Handle invalid key
        licenseMessage.textContent = result.message || 'Invalid license key.';
        licenseMessage.className = 'error';
        await chrome.storage.sync.remove('license_key');
        updateLicenseUI(null);
      }
    } catch (error) {
      // Handle network errors or server issues
      console.error('Verification request failed:', error);
      licenseMessage.textContent = 'Verification failed. Please check your internet connection and try again.';
      licenseMessage.className = 'error';
    } finally {
      verifyKeyButton.disabled = false;
      verifyKeyButton.textContent = 'Activate Key';
    }
  });

  const POLICY_WARNING_MSG = `Due to Chrome policy restrictions, your shortcut settings have not been fully applied. To complete the change, please open <a href="chrome://extensions/shortcuts" target="_blank">chrome://extensions/shortcuts</a> and set the shortcut for "Switch to Last Tab".`;

  // Tab count input validation
  tabCountInput.addEventListener('input', () => {
    const value = parseInt(tabCountInput.value);
    if (isNaN(value) || value < 2 || value > 20) {
      tabCountInput.classList.add('error');
      tabCountNote.classList.add('error');
      tabCountNote.textContent = 'Please enter a number between 2 and 20.';
    } else {
      tabCountInput.classList.remove('error');
      tabCountNote.classList.remove('error');
      tabCountNote.textContent = "Enter a number between 2 and 20";
    }
  });

  // Render dropdown options for shortcut modifier
  function renderModifierOptions() {
    const isMac = navigator.platform.includes('Mac');
    const options = isMac
      ? ["control", "option", "command"]
      : ["control", "alt"];
    modifierSelect.innerHTML = '';
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      if (!isMac && opt === 'control') {
        o.textContent = 'Ctrl';
      } else {
        o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      }
      modifierSelect.appendChild(o);
    });
  }
  renderModifierOptions();

  // Listen for dropdown and main key input to update currentKeys
  function updateCurrentKeys() {
    const mod = modifierSelect.value;
    const key = mainkeyInput.value.trim();
    if (mod && key) {
      currentKeys = [mod.charAt(0).toUpperCase() + mod.slice(1), key.length === 1 ? key.toUpperCase() : key];
    } else {
      currentKeys = [];
    }
  }
  modifierSelect.addEventListener('change', () => {
    updateCurrentKeys();
    validateShortcutInput();
  });

  const debouncedInputHandler = debounce(() => {
    updateCurrentKeys();
    validateShortcutInput();
  }, 250); // 250ms delay

  mainkeyInput.addEventListener('input', debouncedInputHandler);

  mainkeyInput.placeholder = 'Enter a key';

  // Validate the shortcut input fields
  function validateShortcutInput() {
    const key = mainkeyInput.value.trim();
    if (!key) {
      mainkeyInput.classList.add('error');
      mainkeyError.textContent = 'Shortcut key cannot be empty.';
      mainkeyError.style.display = 'block';
      saveButton.disabled = true;
    } else if (key.length > 1) {
      mainkeyInput.classList.add('error');
      mainkeyError.textContent = 'Only one character is allowed.';
      mainkeyError.style.display = 'block';
      saveButton.disabled = true;
    } else {
      mainkeyInput.classList.remove('error');
      mainkeyError.style.display = 'none';
      saveButton.disabled = false;
    }
  }
  
  // Initial validation
  validateShortcutInput();

  // Always add event for shortcut link
  document.body.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.href.startsWith('chrome://')) {
      e.preventDefault();
      if (chrome && chrome.tabs) {
          chrome.tabs.create({ url: e.target.href });
      }
    }
  });

  function parseChromeShortcut(shortcut) {
    if (!shortcut) return [];
    
    // Using Unicode escape sequences to avoid file encoding issues.
    const symbolMap = {
        '\u2318': 'Command', // ⌘
        '\u2303': 'Control', // ⌃ (Changed from Ctrl to Control for consistency)
        '\u2325': 'Option',  // ⌥
        '\u21E7': 'Shift'    // ⇧
    };

    let modifier = '';
    let mainKey = '';

    const firstChar = shortcut.charAt(0);
    if (symbolMap[firstChar]) {
        modifier = symbolMap[firstChar];
        mainKey = shortcut.slice(1);
    } else {
        const parts = shortcut.split('+');
        if (parts.length > 1) {
            mainKey = parts.pop();
            modifier = parts.join('+');
        } else {
            mainKey = shortcut;
        }
    }
    
    return [modifier, mainKey];
  }

  function getActiveShortcut() {
    return new Promise(resolve => {
        if (!chrome || !chrome.commands || !chrome.commands.getAll) {
            return resolve(null);
        }
        chrome.commands.getAll(commands => {
            const cmd = commands.find(c => c.name === 'open-last-tab');
            if (cmd && cmd.shortcut) {
                resolve(cmd.shortcut);
            } else {
                resolve(null);
            }
        });
    });
  }

  // Asynchronously fetch and display the currently set command shortcut
  // This is the single source of truth on popup load.
  if (chrome && chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll((commands) => {
      const cmd = commands.find(c => c.name === 'open-last-tab');
      if (cmd && cmd.shortcut) {
        activeShortcut = cmd.shortcut; // Cache the shortcut
        const [modifier, mainKey] = parseChromeShortcut(cmd.shortcut);
        
        // Update the UI
        if (modifier) modifierSelect.value = modifier.toLowerCase();
        if (mainKey) mainkeyInput.value = mainKey;
        
        // Finalize the initial state with the real shortcut
        const realShortcutKeys = [modifier, mainKey].filter(Boolean);
        initialSettings.customShortcut = { keys: realShortcutKeys };
        currentKeys = realShortcutKeys;
        
        validateShortcutInput();
      } else {
        // This handles the case on first install where no shortcut is explicitly set yet.
        // We'll set the UI to the platform-specific default.
        const isMac = navigator.platform.includes('Mac');
        let defaultModifier, defaultMainKey;
        if (isMac) {
          defaultModifier = 'command';
          defaultMainKey = 'B';
        } else {
          defaultModifier = 'control';
          defaultMainKey = 'Q';
        }
        modifierSelect.value = defaultModifier;
        mainkeyInput.value = defaultMainKey;

        // Also update the initial state to reflect this default
        initialSettings.customShortcut = { keys: [defaultModifier.charAt(0).toUpperCase() + defaultModifier.slice(1), defaultMainKey] };
        updateCurrentKeys();
        validateShortcutInput();
      }
    });
  }


  // Reset to default shortcut
  resetButton.addEventListener('click', async () => {
    const isMac = navigator.platform.includes('Mac');
    let defaultKeys;
    let defaultModifier;
    let defaultMainKey;

    if (isMac) {
      defaultKeys = ['Command', 'B'];
      defaultModifier = 'command';
      defaultMainKey = 'B';
    } else {
      defaultKeys = ['Control', 'Q'];
      defaultModifier = 'control';
      defaultMainKey = 'Q';
    }

    modifierSelect.value = defaultModifier;
    mainkeyInput.value = defaultMainKey;

    validateShortcutInput();
    tabCountInput.value = 2;
    tabCountInput.classList.remove('error');
    tabCountNote.classList.remove('error');
    tabCountNote.textContent = 'Enter a number between 2 and 20';
    mainkeyInput.classList.remove('error');
    mainkeyError.style.display = 'none';

    try {
      await chrome.storage.sync.set({
        tabHistoryCount: 2,
        customShortcut: { keys: defaultKeys }
      });
      await chrome.storage.local.set({
        tabHistoryCount: 2,
        customShortcut: { keys: defaultKeys }
      });
      await chrome.runtime.sendMessage({ action: 'updateTabHistoryCount', count: 2 });
      
      successMessage.style.display = 'none';
      shortcutWarning.style.display = 'none';

      // Compare with the cached active shortcut
      const [mod, key] = parseChromeShortcut(activeShortcut);
      const activeShortcutKeys = [mod, key].filter(Boolean);

      if (JSON.stringify(activeShortcutKeys) === JSON.stringify(defaultKeys)) {
        successMessage.textContent = 'Settings reset successfully!';
        successMessage.style.display = 'block';
        setTimeout(() => {
          successMessage.style.display = 'none';
        }, 3000);
      } else {
        shortcutWarning.innerHTML = POLICY_WARNING_MSG;
        shortcutWarning.style.display = 'block';
        saveButton.disabled = true;
      }

    } catch (error) {
      console.error("Failed to reset settings:", error);
    }
  });


  // Save settings
  saveButton.addEventListener('click', async () => {
    const newTabHistoryCount = parseInt(tabCountInput.value);
    let hasError = false;

    if (isNaN(newTabHistoryCount) || newTabHistoryCount < 2 || newTabHistoryCount > 20) {
      tabCountInput.classList.add('error');
      tabCountNote.classList.add('error');
      tabCountNote.textContent = 'Please enter a number between 2 and 20.';
      hasError = true;
    }
    
    validateShortcutInput();
    if(saveButton.disabled){
        hasError = true;
    }

    if (hasError) {
      return;
    }

    const shortcutChanged = JSON.stringify(currentKeys) !== JSON.stringify(initialSettings.customShortcut.keys);
    const tabCountChanged = newTabHistoryCount !== initialSettings.tabHistoryCount;

    try {
      await chrome.storage.sync.set({
        tabHistoryCount: newTabHistoryCount,
        customShortcut: { keys: currentKeys }
      });
      await chrome.storage.local.set({
        tabHistoryCount: newTabHistoryCount,
        customShortcut: { keys: currentKeys }
      });
      
      await chrome.runtime.sendMessage({ action: 'updateTabHistoryCount', count: newTabHistoryCount });
      const shortcutResponse = await chrome.runtime.sendMessage({ action: 'updateShortcut', shortcut: { keys: currentKeys } });
      
      successMessage.style.display = 'none';
      shortcutWarning.style.display = 'none';

      if (shortcutChanged) {
        if (shortcutResponse && shortcutResponse.status === 'in_use') {
          shortcutWarning.textContent = `The shortcut '${shortcutResponse.shortcut}' is already in use by another extension or a browser command. Please choose a different one.`;
        } else {
          shortcutWarning.innerHTML = POLICY_WARNING_MSG;
        }
        shortcutWarning.style.display = 'block';
      } else if (tabCountChanged) {
        successMessage.textContent = 'Settings saved successfully!';
        successMessage.style.display = 'block';
        setTimeout(() => {
          successMessage.style.display = 'none';
        }, 3000);
      } else {
        successMessage.textContent = 'Settings saved successfully!';
        successMessage.style.display = 'block';
        setTimeout(() => {
          successMessage.style.display = 'none';
        }, 3000);
      }

    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings. Please try again.");
    }
  });
}); 