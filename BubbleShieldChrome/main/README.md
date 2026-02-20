# 🛡️ Bubble Shield

A privacy-focused browser extension that filters tweets on Twitter/X based on keywords found in the tweet author's profile bio.

## Features

-  **Local-only processing** - No external API calls or data transmission
-  **Privacy-first** - Uses Twitter's hover cards, nothing leaves your device
-  **Super efficient** - Leverages Twitter's native hover feature, no network requests needed
-  **Smart caching** - Results cached for 24 hours to minimize repeated checks
-  **Automatic filtering** - Works seamlessly as you scroll your timeline
-  **Easy configuration** - Simple options page to manage blocked keywords
-  **Cross-browser** - Works on Chrome, Edge, Brave, and Firefox

## How It Works

1. As you scroll through Twitter/X, the extension detects tweet elements
2. For each tweet, it extracts the author's username
3. The extension programmatically triggers Twitter's hover card (the popup that shows when you hover over a username)
4. It extracts the profile bio directly from the hover card
5. If the bio contains any of your blocked keywords, the tweet is hidden
6. Results are cached for 24 hours to avoid re-checking the same users

**All of this happens locally in your browser** - no external servers, no network requests, no data transmission. The extension uses Twitter's own hover card feature for maximum efficiency.

## Installation

### Chrome / Edge / Brave (Manifest V3)

1. Download or clone this repository
2. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the folder containing these extension files
6. The extension is now installed! 

## Configuration

1. Click the extension icon in your browser toolbar, or right-click and select **Options**
2. Enter keywords or phrases you want to block (one per line)
   - Example keywords: `crypto`, `NFT`, `web3`, `day trader`
3. Click **Save Settings**
4. Refresh Twitter/X to apply changes to already-loaded tweets

### Tips for Effective Filtering

- **Be specific**: Use specific phrases like "crypto trader" instead of just "crypto" to avoid over-filtering
- **Case-insensitive**: Keywords match regardless of case (e.g., "NFT" matches "nft" and "Nft")
- **Substring matching**: Keywords match partial text (e.g., "web3" matches "web3 developer")
- **Refresh after changes**: After updating keywords, refresh Twitter/X to re-scan visible tweets

## File Structure

```
twitter-bio-filter/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker for profile fetching and bio checking
├── content.js          # Content script for tweet detection and hiding
├── options.html        # Options page UI
├── options.js          # Options page logic
└── README.md          # This file
```

## How the Code Works

### `manifest.json`
Defines the extension structure, permissions, and configuration. Uses Manifest V3 for modern browsers.

### `background.js` (Service Worker)
- Minimal service worker for extension lifecycle management
- All filtering logic happens in the content script for better performance

### `content.js` (Content Script)
- Runs on `twitter.com` and `x.com` pages
- Uses `MutationObserver` to detect new tweets as they appear
- Extracts usernames from tweet elements
- Programmatically triggers hover cards to extract bios
- Checks if bios contain blocked keywords (locally)
- Hides tweets from blocked users with CSS
- Caches bio data for 24 hours to minimize hover card triggers

### `options.html` + `options.js`
- Provides a clean UI for managing blocked keywords
- Saves keywords to `chrome.storage.sync`
- Automatically syncs across devices (if browser sync is enabled)

## Privacy & Security

- **No network requests**: The extension uses Twitter's native hover cards - no additional fetching
- **No data transmission**: Nothing is sent to external servers or third parties
- **Zero external API calls**: All data comes from Twitter's own DOM elements
- **Local storage only**: Keywords and cache are stored locally in your browser
- **No tracking**: The extension doesn't track or log your activity

## Troubleshooting

### Tweets aren't being filtered
1. Check that you've saved keywords in the options page
2. Refresh the Twitter/X page after changing keywords
3. Open the browser console (F12) and look for errors prefixed with `[Twitter Bio Filter]`
4. Some users may have empty bios - the extension can only filter based on bio content

### Extension not working
1. Make sure you're on `twitter.com` or `x.com`
2. Check that the extension is enabled in your browser's extensions page
3. Try disabling and re-enabling the extension
4. Check the browser console for errors

## Development

To modify or debug the extension:

1. Make changes to the source files
2. Go to your browser's extensions page
3. Click the **Reload** button for this extension
4. Refresh Twitter/X to see your changes

## License

This extension is provided as-is for personal use. Feel free to modify and distribute as needed.

## Contributing

Found a bug or have a feature request? Contributions are welcome! The codebase is designed to be readable and modular.

### Common Enhancement Ideas
- Add UI to show how many tweets are currently hidden
- Add whitelist functionality for trusted users
- Add regex support for advanced pattern matching
- Add import/export for keyword lists
- Add statistics on blocked users/tweets

## Disclaimer

This extension is not affiliated with, endorsed by, or connected to Twitter/X. It's an independent tool that works by parsing public profile pages. Use at your own discretion.

---

**Made with ❤️ for a cleaner timeline**
