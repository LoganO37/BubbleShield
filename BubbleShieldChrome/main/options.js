/**
 * Options Page Script for Bubble Shield
 *
 * Handles the configuration UI for blocked keywords:
 * - Loading keywords from storage
 * - Saving keywords to storage
 * - Clearing all keywords
 * - Showing save status
 */

const keywordsTextarea = document.getElementById('keywords');
const phrasesTextarea = document.getElementById('phrases');

const saveButton = document.getElementById('save');
const clearButton = document.getElementById('clear');
const statusDiv = document.getElementById('status');
const listSelector = document.getElementById('list-selector');

// State management
let loadedLists = {};
let currentListId = 'custom';

/**
 * Show a status message to the user
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 */
function showStatus(message, type = 'success') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} visible`;

  // Hide after 3 seconds
  setTimeout(() => {
    statusDiv.classList.remove('visible');
  }, 3000);
}

/**
 * Load blocked keywords and settings from storage
 */
async function loadKeywords() {
  try {
    const keys = [
      'blockedKeywords',
      'blockedPhrases',
      'whitelist', // New whitelist key
      'customKeywords',
      'enabledLists',
      'list_nsfw',
      'list_crypto',
      'list_maga',
      'list_racist', // Renamed from nazi
      'list_far_left', // Renamed from communist
      // New keys for smart merging
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

    // If no customKeywords/enabledLists (legacy or first run), migrate
    if (!customKeywords && !enabledLists) {
      const allKeywords = result.blockedKeywords || [];
      customKeywords = [];
      enabledLists = [];

      // Check if the current blockedKeywords contains the NSFW list
      const nsfwList = PREMADE_LISTS.nsfw;
      const isNsfwEnabled = nsfwList.every(kw => allKeywords.includes(kw));

      if (isNsfwEnabled) {
        enabledLists.push('nsfw');
        // Filter out NSFW keywords from custom list
        customKeywords = allKeywords.filter(kw => !nsfwList.includes(kw));
      } else {
        // Just treat everything as custom
        customKeywords = allKeywords;
      }
    }

    // Default fallbacks
    customKeywords = customKeywords || [];
    enabledLists = enabledLists || [];

    // Helper to merge lists
    const mergeList = (listId, defaultList) => {
      // Check if we have smart merge data
      const added = result[`list_${listId}_added`];
      const removed = result[`list_${listId}_removed`];

      if (added && removed) {
        // Smart merge: (Default - Removed) + Added
        const defaultSet = new Set(defaultList.map(k => normalizeText(k)));
        const removedSet = new Set(removed.map(k => normalizeText(k)));

        const filteredDefault = defaultList.filter(k => !removedSet.has(normalizeText(k)));
        return [...filteredDefault, ...added];
      } else {
        // Legacy/First run:
        // If we have a saved list, use it (but this overrides updates)
        // To fix the "override" issue, we migrate:
        // If there's a saved list, we calculate added/removed relative to the OLD default (which we don't have)
        // So we assume:
        // Added = Saved - Default
        // Removed = [] (Reset deletions to ensure new updates are seen, as agreed)

        const savedList = result[`list_${listId}`];
        if (savedList) {
          // Migration: Keep added words, reset deletions (by including all defaults)
          const defaultSet = new Set(defaultList.map(k => normalizeText(k)));
          const savedSet = new Set(savedList.map(k => normalizeText(k)));

          // Find words in savedList that are NOT in defaultList (User added)
          const userAdded = savedList.filter(k => !defaultSet.has(normalizeText(k)));

          // Return Default + User Added
          return [...defaultList, ...userAdded];
        }

        // No saved list, return default
        return defaultList;
      }
    };

    // Initialize loadedLists with smart merging
    loadedLists = {
      custom: customKeywords,
      nsfw: mergeList('nsfw', PREMADE_LISTS.nsfw),
      crypto: mergeList('crypto', PREMADE_LISTS.crypto),
      maga: mergeList('maga', PREMADE_LISTS.MAGA),
      racist: mergeList('racist', PREMADE_LISTS.Racist), // Renamed
      'far-left': mergeList('far_left', PREMADE_LISTS.FarLeft) // Renamed
    };

    // Update UI
    // Checkboxes
    document.getElementById('list-nsfw').checked = enabledLists.includes('nsfw');
    document.getElementById('list-crypto').checked = enabledLists.includes('crypto');
    document.getElementById('list-maga').checked = enabledLists.includes('MAGA');
    document.getElementById('list-racist').checked = enabledLists.includes('Racist'); // Renamed
    document.getElementById('list-far-left').checked = enabledLists.includes('FarLeft'); // Renamed

    // Textarea (load current list)
    currentListId = listSelector.value;
    keywordsTextarea.value = loadedLists[currentListId].join('\n');

    // Load phrases
    const phrases = result.blockedPhrases || [];
    phrasesTextarea.value = phrases.join('\n');

    // Load whitelist
    const whitelist = result.whitelist || [];
    document.getElementById('whitelist').value = whitelist.join('\n');

    console.log(`[Bubble Shield] Loaded settings. Enabled lists: ${enabledLists.join(', ')}`);
  } catch (error) {
    console.error('[Bubble Shield] Error loading keywords:', error);
    showStatus('Error loading settings', 'error');
  }
}

/**
 * Normalize text for consistent matching
 * Handles case, unicode normalization, and removes variation selectors (for emojis)
 * @param {string} text - The text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\uFE00-\uFE0F]/g, ''); // Remove variation selectors
}

/**
 * Handle list selection change
 */
function handleListChange() {
  // Save current textarea content to memory
  const text = keywordsTextarea.value;
  const keywords = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Deduplicate and normalize
  // We want to store the normalized version to avoid issues
  loadedLists[currentListId] = [...new Set(keywords.map(k => normalizeText(k)))]
    .filter(k => k.length > 0);

  // Switch to new list
  currentListId = listSelector.value;
  keywordsTextarea.value = loadedLists[currentListId].join('\n');
}

/**
 * Save blocked keywords and settings to storage
 */
async function saveKeywords() {
  try {
    // Update current list in memory from textarea
    const text = keywordsTextarea.value;
    const currentKeywords = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Deduplicate and normalize current list
    loadedLists[currentListId] = [...new Set(currentKeywords.map(k => normalizeText(k)))]
      .filter(k => k.length > 0);

    // Get enabled lists
    const enabledLists = [];
    if (document.getElementById('list-nsfw').checked) enabledLists.push('nsfw');
    if (document.getElementById('list-crypto').checked) enabledLists.push('crypto');
    if (document.getElementById('list-maga').checked) enabledLists.push('MAGA');
    if (document.getElementById('list-racist').checked) enabledLists.push('Racist'); // Renamed
    if (document.getElementById('list-far-left').checked) enabledLists.push('FarLeft'); // Renamed

    // Combine all keywords for the content script
    let allKeywords = [...loadedLists.custom];

    // Prepare storage object
    const storageData = {
      customKeywords: loadedLists.custom,
      enabledLists: enabledLists
    };

    // Helper to calculate diffs
    const calculateDiff = (listId, currentList, defaultList) => {
      const currentSet = new Set(currentList.map(k => normalizeText(k)));
      const defaultSet = new Set(defaultList.map(k => normalizeText(k)));

      // Added = Current - Default
      const added = currentList.filter(k => !defaultSet.has(normalizeText(k)));

      // Removed = Default - Current
      const removed = defaultList.filter(k => !currentSet.has(normalizeText(k)));

      return { added, removed };
    };

    // Process each list
    const lists = [
      { id: 'nsfw', default: PREMADE_LISTS.nsfw },
      { id: 'crypto', default: PREMADE_LISTS.crypto },
      { id: 'maga', default: PREMADE_LISTS.MAGA },
      { id: 'racist', default: PREMADE_LISTS.Racist }, // Renamed
      { id: 'far-left', default: PREMADE_LISTS.FarLeft } // Renamed
    ];

    for (const list of lists) {
      // Handle key mismatch for far-left (id is 'far-left', loadedLists key is 'far-left', but storage key uses underscore)
      const storageKeyId = list.id === 'far-left' ? 'far_left' : list.id;

      const currentList = loadedLists[list.id];
      const { added, removed } = calculateDiff(storageKeyId, currentList, list.default);

      // Store diffs
      storageData[`list_${storageKeyId}_added`] = added;
      storageData[`list_${storageKeyId}_removed`] = removed;

      // Also store the full list for backward compatibility / easy viewing
      storageData[`list_${storageKeyId}`] = currentList;

      // Add to allKeywords if enabled
      // Map lowercase list IDs to the IDs used in enabledLists
      const enabledIdMap = {
        'nsfw': 'nsfw',
        'crypto': 'crypto',
        'maga': 'MAGA',
        'racist': 'Racist',
        'far-left': 'FarLeft'
      };

      const enabledId = enabledIdMap[list.id];

      if (enabledLists.includes(enabledId)) {
        allKeywords = allKeywords.concat(currentList);
      }
    }

    // Deduplicate final list
    const uniqueAllKeywords = [...new Set(allKeywords.map(k => normalizeText(k)))]
      .filter(k => k.length > 0);

    storageData.blockedKeywords = uniqueAllKeywords;

    // Save phrases
    const phrasesText = phrasesTextarea.value;
    const phrases = phrasesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Deduplicate phrases
    storageData.blockedPhrases = [...new Set(phrases)];

    // Save whitelist
    const whitelistText = document.getElementById('whitelist').value;
    const whitelist = whitelistText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Normalize whitelist usernames (ensure they start with @)
    storageData.whitelist = [...new Set(whitelist.map(u => u.startsWith('@') ? u : '@' + u))];

    // Save to storage
    await chrome.storage.sync.set(storageData);

    console.log(`[Bubble Shield] Saved. Lists: ${enabledLists.join(', ')}, Total keywords: ${uniqueAllKeywords.length}`);
    showStatus(`Settings saved (${uniqueAllKeywords.length} total keywords)`, 'success');

    // Update textarea (it's already updated, but good to be sure)
    keywordsTextarea.value = loadedLists[currentListId].join('\n');

  } catch (error) {
    console.error('[Bubble Shield] Error saving settings:', error);
    showStatus('Error saving settings', 'error');
  }
}

/**
 * Clear all keywords
 */
async function clearKeywords() {
  if (!confirm('Are you sure you want to clear all blocked keywords?')) {
    return;
  }

  try {
    await chrome.storage.sync.set({
      blockedKeywords: [],
      blockedPhrases: []
    });
    keywordsTextarea.value = '';
    phrasesTextarea.value = '';
    console.log('[Bubble Shield] Cleared all keywords and phrases');
    showStatus('All keywords and phrases cleared', 'success');
  } catch (error) {
    console.error('[Bubble Shield] Error clearing keywords:', error);
    showStatus('Error clearing keywords', 'error');
  }
}

/**
 * Handle keyboard shortcuts in textarea
 */
function handleKeydown(event) {
  // Ctrl+S / Cmd+S to save
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveKeywords();
  }
}

// Event listeners
saveButton.addEventListener('click', saveKeywords);
clearButton.addEventListener('click', clearKeywords);
keywordsTextarea.addEventListener('keydown', handleKeydown);
phrasesTextarea.addEventListener('keydown', handleKeydown);
listSelector.addEventListener('change', handleListChange);

// Load keywords when page opens
document.addEventListener('DOMContentLoaded', loadKeywords);

console.log('[Bubble Shield] Options page initialized');
