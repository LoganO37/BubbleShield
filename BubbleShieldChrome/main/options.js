'use strict';

/**
 * Options Page Script for Bubble Shield
 *
 * Manages the settings UI using component APIs (ChipInput, TabBar, etc.)
 * Handles loading/saving keywords, phrases, whitelist, import/export.
 */

// Centralized list configuration — single source of truth for list IDs.
const LIST_CONFIG = [
  { id: 'nsfw', storageKey: 'nsfw', enabledId: 'nsfw', label: 'NSFW', premadeKey: 'nsfw' },
  { id: 'crypto', storageKey: 'crypto', enabledId: 'crypto', label: 'Crypto', premadeKey: 'crypto' },
  { id: 'maga', storageKey: 'maga', enabledId: 'MAGA', label: 'MAGA', premadeKey: 'MAGA' },
  { id: 'racist', storageKey: 'racist', enabledId: 'Racist', label: 'Racist', premadeKey: 'Racist' },
  { id: 'far-left', storageKey: 'far_left', enabledId: 'FarLeft', label: 'Far-Left', premadeKey: 'FarLeft' },
];

// ─── State ──────────────────────────────────────────────────

let loadedLists = {};
let currentTabId = 'custom';
let enabledListStates = {}; // { nsfw: true, crypto: false, ... }
let initialEnabledStates = {};

// Component instances
let tabBar = null;
let keywordChips = null;
let phrasesChips = null;
let whitelistChips = null;
let phrasesSection = null;
let whitelistSection = null;

// ─── Normalize (must match content_script.js) ───────────────

function normalizeText(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\uFE00-\uFE0F]/g, '');
}

// ─── Component Initialization ───────────────────────────────

function initComponents() {
  // Tab bar
  const tabDefs = [
    { id: 'custom', label: 'Custom', count: 0, hasToggle: false }
  ];
  for (const cfg of LIST_CONFIG) {
    tabDefs.push({
      id: cfg.id,
      label: cfg.label,
      count: 0,
      hasToggle: true,
      enabled: false
    });
  }

  tabBar = new TabBar({
    container: document.getElementById('tab-bar-container'),
    tabs: tabDefs,
    activeTabId: 'custom',
    onTabChange: handleTabChange,
    onToggleChange: handleToggleChange
  });

  // Keyword chips
  keywordChips = new ChipInput({
    container: document.getElementById('keyword-chips-container'),
    placeholder: 'Type a keyword and press Enter',
    ariaLabel: 'Blocked keywords',
    normalize: normalizeText,
    onChange: () => {
      updateTabCount(currentTabId);
      updateDirtyWarning();
    }
  });

  // Phrases section (collapsible)
  phrasesSection = new CollapsibleSection({
    container: document.getElementById('phrases-section'),
    title: 'Blocked Phrases (Tweet Content)',
    initiallyOpen: true,
    ariaLabel: 'Blocked phrases section'
  });

  const phrasesHelp = document.createElement('p');
  phrasesHelp.className = 'help-text';
  phrasesHelp.innerHTML =
    'Enter phrases to hide specific tweets without blocking the user. ' +
    'Tweets containing these phrases will be hidden, but the user will NOT be added to your block cache.<br>' +
    '<strong>Case-insensitive partial matching.</strong>';
  phrasesSection.getContent().appendChild(phrasesHelp);

  phrasesChips = new ChipInput({
    container: phrasesSection.getContent(),
    placeholder: 'Type a phrase and press Enter',
    ariaLabel: 'Blocked phrases',
    normalize: normalizeText,
    onChange: () => updateDirtyWarning()
  });

  // Whitelist section (collapsible)
  whitelistSection = new CollapsibleSection({
    container: document.getElementById('whitelist-section'),
    title: 'Whitelisted Users (Exempt)',
    initiallyOpen: true,
    ariaLabel: 'Whitelisted users section'
  });

  const whitelistHelp = document.createElement('p');
  whitelistHelp.className = 'help-text';
  whitelistHelp.innerHTML =
    'Enter usernames to exempt from filtering. These users will NEVER be blocked.<br>' +
    '<strong>Format:</strong> @username';
  whitelistSection.getContent().appendChild(whitelistHelp);

  whitelistChips = new ChipInput({
    container: whitelistSection.getContent(),
    placeholder: 'Type a @username and press Enter',
    ariaLabel: 'Whitelisted users',
    normalize: (v) => {
      const clean = v.trim().replace(/^@+/, '');
      return clean ? '@' + clean.toLowerCase() : '';
    },
    onChange: () => updateDirtyWarning()
  });

  // Info sections (collapsible, closed by default)
  const howItWorksSection = new CollapsibleSection({
    container: document.getElementById('how-it-works-section'),
    title: 'How it works',
    initiallyOpen: false,
    ariaLabel: 'How it works section'
  });
  howItWorksSection.getContent().innerHTML = `
    <div class="info-box info-box--inline">
      <ul>
        <li>As you scroll Twitter/X, the extension checks each tweet author's bio</li>
        <li>If a bio contains any of your blocked keywords, that tweet is hidden</li>
        <li>Profile data is fetched using your existing Twitter/X session (no API required)</li>
        <li>Results are cached for 48 hours to improve performance</li>
        <li><strong>Privacy:</strong> All data stays on your device - nothing is sent to external servers</li>
      </ul>
      <h2>Tips</h2>
      <ul>
        <li><strong>Partial matching works:</strong> "Chicago Cubs" matches "I love the Chicago Cubs!"</li>
        <li><strong>Case doesn't matter:</strong> "NFT" matches "nft", "Nft", "NFT", etc.</li>
        <li><strong>Be specific to avoid over-filtering:</strong> Use "crypto trader" instead of "crypto"</li>
        <li><strong>Phrases work:</strong> Multi-word phrases like "day trader" are fully supported</li>
        <li>After changing keywords, refresh Twitter/X to apply changes to already-loaded tweets</li>
      </ul>
    </div>
  `;

  const howUpdatesSection = new CollapsibleSection({
    container: document.getElementById('how-updates-section'),
    title: 'How Updates Work',
    initiallyOpen: false,
    ariaLabel: 'How updates work section'
  });
  howUpdatesSection.getContent().innerHTML = `
    <div class="info-box info-box--inline">
      <p>Bubble Shield uses a smart merging system:</p>
      <ul>
        <li><strong>New Words:</strong> When the extension updates, new blocked words added by the developer will
          automatically appear in your lists.</li>
        <li><strong>Your Edits:</strong> Any words you manually add or remove will be remembered and preserved.</li>
      </ul>
      <p><em>Note: If you had previously removed a default word, it may reappear once after a major update to ensure you
          see the latest changes.</em></p>
    </div>
  `;

  // Import/Export buttons
  document.getElementById('export-btn').addEventListener('click', exportSettings);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importSettings(e.target.files[0]);
    }
  });

  // Save/Clear
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('clear').addEventListener('click', clearSettings);

  // Global keyboard shortcut
  document.addEventListener('keydown', handleGlobalKeydown);
}

// ─── Data Loading ───────────────────────────────────────────

async function loadSettings() {
  try {
    const keys = [
      'blockedKeywords', 'blockedPhrases', 'whitelist',
      'customKeywords', 'enabledLists',
      'list_nsfw', 'list_crypto', 'list_maga', 'list_racist', 'list_far_left',
      'list_nsfw_added', 'list_nsfw_removed',
      'list_crypto_added', 'list_crypto_removed',
      'list_maga_added', 'list_maga_removed',
      'list_racist_added', 'list_racist_removed',
      'list_far_left_added', 'list_far_left_removed'
    ];

    const result = await chrome.storage.sync.get(keys);

    // Handle migration or initial load
    let customKeywords = result.customKeywords;
    let enabledLists = result.enabledLists;

    if (!customKeywords && !enabledLists) {
      const allKeywords = result.blockedKeywords || [];
      customKeywords = [];
      enabledLists = [];

      const nsfwList = PREMADE_LISTS.nsfw;
      const isNsfwEnabled = nsfwList.every(kw => allKeywords.includes(kw));

      if (isNsfwEnabled) {
        enabledLists.push('nsfw');
        customKeywords = allKeywords.filter(kw => !nsfwList.includes(kw));
      } else {
        customKeywords = allKeywords;
      }
    }

    customKeywords = customKeywords || [];
    enabledLists = enabledLists || [];

    // Smart merge helper
    const mergeList = (listId, defaultList) => {
      const added = result[`list_${listId}_added`];
      const removed = result[`list_${listId}_removed`];

      if (added && removed) {
        const removedSet = new Set(removed.map(k => normalizeText(k)));
        const filteredDefault = defaultList.filter(k => !removedSet.has(normalizeText(k)));
        return [...filteredDefault, ...added];
      } else {
        const savedList = result[`list_${listId}`];
        if (savedList) {
          const defaultSet = new Set(defaultList.map(k => normalizeText(k)));
          const userAdded = savedList.filter(k => !defaultSet.has(normalizeText(k)));
          return [...defaultList, ...userAdded];
        }
        return [...defaultList];
      }
    };

    // Populate loadedLists
    loadedLists = { custom: customKeywords };
    for (const cfg of LIST_CONFIG) {
      loadedLists[cfg.id] = mergeList(cfg.storageKey, PREMADE_LISTS[cfg.premadeKey]);
    }

    // Populate enabled states
    enabledListStates = {};
    for (const cfg of LIST_CONFIG) {
      enabledListStates[cfg.id] = enabledLists.includes(cfg.enabledId);
    }
    initialEnabledStates = { ...enabledListStates };

    // Set tab toggle states and counts
    for (const cfg of LIST_CONFIG) {
      tabBar.setTabEnabled(cfg.id, enabledListStates[cfg.id]);
      tabBar.setTabCount(cfg.id, loadedLists[cfg.id].length);
    }
    tabBar.setTabCount('custom', loadedLists.custom.length);

    // Populate keyword chips for the active tab
    const defaultSet = getDefaultSetForTab(currentTabId);
    keywordChips.defaultValues = defaultSet;
    keywordChips.setValues(loadedLists[currentTabId]);

    // Populate phrases
    const phrases = result.blockedPhrases || [];
    phrasesChips.setValues(phrases);

    // Populate whitelist
    const whitelist = result.whitelist || [];
    whitelistChips.setValues(whitelist);

    // Show main content, hide loading
    document.getElementById('loading-state').hidden = true;
    document.getElementById('main-content').hidden = false;

    console.log(`[Bubble Shield] Loaded settings. Enabled lists: ${enabledLists.join(', ')}`);
  } catch (error) {
    console.error('[Bubble Shield] Error loading settings:', error);
    Toast.show('Error loading settings', 'error');
    document.getElementById('loading-state').hidden = true;
    document.getElementById('main-content').hidden = false;
  }
}

function getDefaultSetForTab(tabId) {
  if (tabId === 'custom') return new Set();
  const cfg = LIST_CONFIG.find(c => c.id === tabId);
  if (!cfg) return new Set();
  return new Set(PREMADE_LISTS[cfg.premadeKey].map(k => normalizeText(k)));
}

// ─── Tab / Toggle Handlers ──────────────────────────────────

function handleTabChange(newTabId) {
  // Persist current chip values
  loadedLists[currentTabId] = keywordChips.getValues();

  // Switch
  currentTabId = newTabId;

  // Update panel aria
  const panel = document.getElementById('keyword-panel');
  panel.setAttribute('aria-labelledby', `tab-${newTabId}`);

  // Load new tab's values
  const defaultSet = getDefaultSetForTab(newTabId);
  keywordChips.defaultValues = defaultSet;
  keywordChips.setValues(loadedLists[newTabId]);
}

function handleToggleChange(tabId, enabled) {
  enabledListStates[tabId] = enabled;
  updateDirtyWarning();
}

function updateTabCount(tabId) {
  loadedLists[tabId] = keywordChips.getValues();
  tabBar.setTabCount(tabId, loadedLists[tabId].length);
}

// ─── Dirty State Tracking ───────────────────────────────────

function hasDirtyState() {
  // Persist current tab values for comparison
  loadedLists[currentTabId] = keywordChips.getValues();

  if (keywordChips.isDirty()) return true;
  if (phrasesChips.isDirty()) return true;
  if (whitelistChips.isDirty()) return true;

  // Check toggle changes
  for (const cfg of LIST_CONFIG) {
    if (enabledListStates[cfg.id] !== initialEnabledStates[cfg.id]) return true;
  }

  return false;
}

function updateDirtyWarning() {
  const warning = document.getElementById('unsaved-warning');
  if (warning) {
    warning.hidden = !hasDirtyState();
  }
}

function registerBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    if (hasDirtyState()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ─── Save / Clear ───────────────────────────────────────────

async function saveSettings() {
  try {
    // Persist current tab values
    loadedLists[currentTabId] = keywordChips.getValues();

    // Build enabled list IDs
    const enabledLists = [];
    for (const cfg of LIST_CONFIG) {
      if (enabledListStates[cfg.id]) enabledLists.push(cfg.enabledId);
    }

    // Combine all keywords
    let allKeywords = [...loadedLists.custom];

    const storageData = {
      customKeywords: loadedLists.custom,
      enabledLists: enabledLists
    };

    // Calculate diffs for each list
    for (const cfg of LIST_CONFIG) {
      const currentList = loadedLists[cfg.id];
      const defaultList = PREMADE_LISTS[cfg.premadeKey];

      const currentSet = new Set(currentList.map(k => normalizeText(k)));
      const defaultSet = new Set(defaultList.map(k => normalizeText(k)));

      const added = currentList.filter(k => !defaultSet.has(normalizeText(k)));
      const removed = defaultList.filter(k => !currentSet.has(normalizeText(k)));

      storageData[`list_${cfg.storageKey}_added`] = added;
      storageData[`list_${cfg.storageKey}_removed`] = removed;
      storageData[`list_${cfg.storageKey}`] = currentList;

      if (enabledListStates[cfg.id]) {
        allKeywords = allKeywords.concat(currentList);
      }
    }

    // Deduplicate
    const uniqueKeywords = [...new Set(allKeywords.map(k => normalizeText(k)))]
      .filter(k => k.length > 0);
    storageData.blockedKeywords = uniqueKeywords;

    // Phrases
    storageData.blockedPhrases = [...new Set(phrasesChips.getValues())];

    // Whitelist
    storageData.whitelist = [...new Set(whitelistChips.getValues())];

    await chrome.storage.sync.set(storageData);

    // Mark all components clean
    keywordChips.markClean();
    phrasesChips.markClean();
    whitelistChips.markClean();
    initialEnabledStates = { ...enabledListStates };
    updateDirtyWarning();

    console.log(`[Bubble Shield] Saved. Lists: ${enabledLists.join(', ')}, Total keywords: ${uniqueKeywords.length}`);
    Toast.show(`Settings saved (${uniqueKeywords.length} total keywords)`, 'success');
  } catch (error) {
    console.error('[Bubble Shield] Error saving settings:', error);
    Toast.show('Error saving settings', 'error');
  }
}

async function clearSettings() {
  const confirmed = await ConfirmModal.confirm({
    title: 'Clear All Settings?',
    message: 'This will remove all keywords, phrases, and whitelist entries. Premade lists will be reset to defaults.',
    confirmText: 'Clear All',
    cancelText: 'Cancel',
    confirmStyle: 'danger'
  });

  if (!confirmed) return;

  try {
    await chrome.storage.sync.clear();

    // Reset state
    loadedLists = { custom: [] };
    for (const cfg of LIST_CONFIG) {
      loadedLists[cfg.id] = [...PREMADE_LISTS[cfg.premadeKey]];
      enabledListStates[cfg.id] = false;
    }
    initialEnabledStates = { ...enabledListStates };

    // Reset components
    currentTabId = 'custom';
    tabBar.setActiveTab('custom');

    for (const cfg of LIST_CONFIG) {
      tabBar.setTabEnabled(cfg.id, false);
      tabBar.setTabCount(cfg.id, loadedLists[cfg.id].length);
    }
    tabBar.setTabCount('custom', 0);

    keywordChips.defaultValues = new Set();
    keywordChips.setValues([]);
    phrasesChips.setValues([]);
    whitelistChips.setValues([]);
    updateDirtyWarning();

    Toast.show('All settings cleared', 'success');
    console.log('[Bubble Shield] Cleared all settings');
  } catch (error) {
    console.error('[Bubble Shield] Error clearing settings:', error);
    Toast.show('Error clearing settings', 'error');
  }
}

// ─── Import / Export ────────────────────────────────────────

function exportSettings() {
  // Persist current tab
  loadedLists[currentTabId] = keywordChips.getValues();

  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    customKeywords: loadedLists.custom,
    enabledLists: [],
    blockedPhrases: phrasesChips.getValues(),
    whitelist: whitelistChips.getValues(),
    lists: {}
  };

  for (const cfg of LIST_CONFIG) {
    if (enabledListStates[cfg.id]) data.enabledLists.push(cfg.enabledId);
    const defaultList = PREMADE_LISTS[cfg.premadeKey];
    const currentList = loadedLists[cfg.id];
    const defaultSet = new Set(defaultList.map(k => normalizeText(k)));
    const currentSet = new Set(currentList.map(k => normalizeText(k)));
    data.lists[cfg.storageKey] = {
      added: currentList.filter(k => !defaultSet.has(normalizeText(k))),
      removed: defaultList.filter(k => !currentSet.has(normalizeText(k)))
    };
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bubble-shield-settings-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  Toast.show('Settings exported', 'success');
}

async function importSettings(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version || !Array.isArray(data.customKeywords)) {
      Toast.show('Invalid settings file', 'error');
      return;
    }

    const storageData = {
      customKeywords: data.customKeywords || [],
      enabledLists: data.enabledLists || [],
      blockedPhrases: data.blockedPhrases || [],
      whitelist: data.whitelist || []
    };

    // Rebuild lists from diffs
    let allKeywords = [...storageData.customKeywords];

    for (const cfg of LIST_CONFIG) {
      const listData = data.lists && data.lists[cfg.storageKey];
      if (listData) {
        storageData[`list_${cfg.storageKey}_added`] = listData.added || [];
        storageData[`list_${cfg.storageKey}_removed`] = listData.removed || [];

        const removedSet = new Set((listData.removed || []).map(k => normalizeText(k)));
        const defaultList = PREMADE_LISTS[cfg.premadeKey];
        const merged = [
          ...defaultList.filter(k => !removedSet.has(normalizeText(k))),
          ...(listData.added || [])
        ];
        storageData[`list_${cfg.storageKey}`] = merged;

        if (storageData.enabledLists.includes(cfg.enabledId)) {
          allKeywords = allKeywords.concat(merged);
        }
      }
    }

    storageData.blockedKeywords = [...new Set(allKeywords.map(k => normalizeText(k)))].filter(k => k.length > 0);

    await chrome.storage.sync.set(storageData);
    Toast.show('Settings imported! Reloading...', 'success');
    setTimeout(() => location.reload(), 1000);
  } catch (error) {
    console.error('[Bubble Shield] Import error:', error);
    Toast.show('Error importing settings: invalid file', 'error');
  }
}

// ─── Keyboard Shortcut ──────────────────────────────────────

function handleGlobalKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveSettings();
  }
}

// ─── Bootstrap ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initComponents();
  await loadSettings();
  registerBeforeUnload();
  console.log('[Bubble Shield] Options page initialized');
});
