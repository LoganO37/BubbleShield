'use strict';

/**
 * Background Service Worker for Bubble Shield
 *
 * This script is kept minimal since all filtering logic happens in the content script.
 * It's here for any future background tasks that might be needed.
 */

importScripts('lists.js');

console.log('[Bubble Shield] Background service worker initialized');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Bubble Shield] Extension installed');

    // Set default blocked keywords using the NSFW list
    const defaultKeywords = PREMADE_LISTS.nsfw;

    chrome.storage.sync.set({
      blockedKeywords: defaultKeywords,
      customKeywords: [], // Initialize empty custom keywords
      enabledLists: ['nsfw'] // Enable NSFW list by default
    }, () => {
      console.log('[Bubble Shield] Default keywords set');
    });

    // Open options page on first install so user can see/edit them
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('[Bubble Shield] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
});
