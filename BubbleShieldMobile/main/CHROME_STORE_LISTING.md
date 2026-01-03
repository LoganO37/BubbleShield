# Chrome Web Store Listing Information

## Extension Name
**Bubble Shield**

## Summary (132 characters max)
Filter tweets based on keywords or author's profile bio. All processing happens locally.

## Description
Bubble Shield is a privacy-focused browser extension that filters tweets on Twitter/X based on keywords found in the tweet author's profile bio.

**Key Features:**
- **100% Local Processing** - No external API calls or data transmission
- **Privacy-First** - Uses Twitter's hover cards, nothing leaves your device
- **Super Efficient** - Leverages Twitter's native hover feature, no extra network requests
- **Smart Caching** - Results cached for 24 hours to minimize repeated checks
- **Automatic Filtering** - Works seamlessly as you scroll your timeline
- **Easy Configuration** - Simple options page to manage blocked keywords

**How It Works:**
1. As you scroll through Twitter/X, the extension detects tweet elements
2. For each tweet, it extracts the author's username
3. The extension programmatically triggers Twitter's hover card (the popup that shows when you hover over a username)
4. It extracts the profile bio directly from the hover card
5. If the bio contains any of your blocked keywords, the tweet is hidden
6. Results are cached for 24 hours to avoid re-checking the same users

**All of this happens locally in your browser** - no external servers, no network requests, no data transmission. The extension uses Twitter's own hover card feature for maximum efficiency.

**Privacy & Security:**
- No network requests - uses Twitter's native hover cards
- No data transmission - nothing sent to external servers
- Zero external API calls - all data from Twitter's own DOM
- Local storage only - keywords and cache stored in your browser
- No tracking - doesn't track or log your activity

**Perfect for users who want:**
- A cleaner timeline free from specific topics
- To avoid certain types of content based on user bios
- Privacy-focused filtering without external services
- A lightweight, efficient filtering solution

## Category
**Social & Communication**

## Language
English

## Privacy Policy
https://bubbleshieldapp.github.io/privacy (or include privacy.html content)

Note: For Chrome Web Store submission, you'll need to host the privacy policy on a public URL. You can:
1. Create a GitHub Pages site with the privacy.html content
2. Host it on your own domain
3. Use the privacy.html file included in the extension

## Screenshots Needed (1280x800 or 640x400)
You'll need to create 3-5 screenshots showing:
1. Extension in action on Twitter/X (tweets being filtered)
2. Options page with keyword configuration
3. Example of hover card interaction
4. Statistics or cache information (if available)
5. Before/after comparison of timeline

## Promotional Tile (440x280, required)
Create a promotional image with:
- Bubble Shield logo
- Text: "Filter Twitter by Bio"
- Subtitle: "100% Local, Privacy-First"

## Small Tile (440x280, optional but recommended)
Same as promotional tile

## Marquee Tile (1400x560, optional)
Larger version of promotional tile for featured listings

## Support Email
BubbleShieldApp@proton.me

## Website
(Optional - add if you have a landing page)

## Permissions Justification

### storage
Used to save user-configured blocked keywords and cache profile bio data locally for 24 hours to improve performance.

### host_permissions (twitter.com, x.com)
Required to run the content script that filters tweets on Twitter/X websites. The extension only works on these domains and does not access any other websites.

## Single Purpose Description
Bubble Shield serves a single purpose: filtering tweets on Twitter/X based on keywords found in the author's profile bio, with all processing happening locally on the user's device.

## Target Audience
- Twitter/X users who want to customize their timeline
- Privacy-conscious users who prefer local processing
- Users who want to filter content without blocking entire accounts
- People looking to avoid specific topics or types of content

## Keywords (for discovery)
twitter filter, x filter, bio filter, tweet filter, privacy, local processing, timeline filter, content filter, twitter extension, x extension
