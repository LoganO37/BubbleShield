/**
 * Background Service Worker for Twitter Bio Filter
 *
 * This script is kept minimal since all filtering logic happens in the content script.
 * It's here for any future background tasks that might be needed.
 */

// Cross-browser compatibility: Use browser namespace (Firefox) or chrome namespace (Chrome/Edge)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

importScripts('lists.js');

console.log('[Twitter Bio Filter] Background service worker initialized');

// Listen for installation
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Twitter Bio Filter] Extension installed');

    // Set default blocked keywords using the NSFW list
    const defaultKeywords = PREMADE_LISTS.nsfw;

    browserAPI.storage.sync.set({
      blockedKeywords: defaultKeywords,
      customKeywords: [], // Initialize empty custom keywords
      enabledLists: ['nsfw'] // Enable NSFW list by default
    }, () => {
      console.log('[Twitter Bio Filter] Default keywords set');
    });

    // Open options page on first install so user can see/edit them
    browserAPI.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('[Twitter Bio Filter] Extension updated to version', browserAPI.runtime.getManifest().version);
  }
});

// Listen for messages from content script
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openOptions') {
    browserAPI.runtime.openOptionsPage();
  }
});
