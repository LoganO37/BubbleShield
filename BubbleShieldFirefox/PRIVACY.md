# Privacy Policy for Bubble Shield

**Last Updated: December 20, 2025**

## Overview

Bubble Shield is committed to protecting your privacy. This extension is designed with privacy as a core principle and operates entirely locally on your device.

## Information Collection and Use

### What We Don't Collect

Bubble Shield does NOT:
- Collect any personal information
- Track your browsing activity
- Send any data to external servers
- Make any network requests beyond what Twitter/X already makes
- Store any information outside your local device
- Use analytics or tracking services
- Share any data with third parties

### What We Store Locally

Bubble Shield stores the following information locally in your browser using the browser's built-in storage API:

1. **Blocked Keywords**: The list of keywords you configure for filtering tweets
2. **Cache Data**: Temporarily cached profile bio information (stored for 24 hours to improve performance)

All of this data:
- Remains exclusively on your device
- Is never transmitted to any server
- Is managed through your browser's standard storage mechanisms
- Can be cleared by removing the extension or clearing browser data

## How the Extension Works

Bubble Shield operates entirely within your browser:

1. Detects tweets as you scroll through Twitter/X
2. Extracts usernames from visible tweets
3. Uses Twitter's native hover card feature to access profile bios
4. Compares bios against your configured keywords locally
5. Hides matching tweets using CSS

**Important**: All processing happens locally. The extension does not make any external API calls or network requests. It only uses Twitter's existing functionality that your browser already loads.

## Permissions Used

The extension requests the following browser permissions:

- **storage**: To save your blocked keywords and cache bio data locally
- **host_permissions** for `twitter.com` and `x.com`: To run the content script that filters tweets on these websites only

These permissions are used exclusively for the extension's core functionality and nothing else.

## Data Sharing

Bubble Shield does not share, sell, rent, or transmit any data to third parties. Since no data is collected, there is nothing to share.

## Browser Sync

If you enable browser synchronization features (like Chrome Sync), your blocked keywords may sync across your devices through your browser's built-in sync mechanism. This is controlled entirely by your browser settings, not by the extension.

## Children's Privacy

Bubble Shield does not knowingly collect any information from anyone, including children under 13.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document.

## Third-Party Services

Bubble Shield does not integrate with any third-party services, analytics platforms, or external APIs.

## Your Rights

Since Bubble Shield does not collect any personal data:
- There is no data to access, modify, or delete
- You can remove all locally stored data by uninstalling the extension
- You can clear cached data through your browser's standard data clearing mechanisms

## Contact

If you have questions about this privacy policy or the extension's privacy practices, please contact us at: **BubbleShieldApp@proton.me**

---

**In Summary**: Bubble Shield collects zero data, makes zero external requests, and keeps everything local to your device. Your privacy is fully protected.
