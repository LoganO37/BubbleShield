# Chrome Web Store Submission Checklist

## Pre-Submission Code Review
- [x] All icon sizes present (16x16, 48x48, 128x128)
- [x] manifest.json properly configured with all required fields
- [x] manifest_version set to 3
- [x] Version number set (1.0.0)
- [x] Description under 132 characters
- [x] Permissions properly declared and justified
- [x] Icons referenced correctly in manifest
- [ ] Test extension in Chrome to ensure it loads without errors
- [ ] Verify extension works on both twitter.com and x.com
- [ ] Check browser console for any errors or warnings
- [ ] Test options page functionality
- [ ] Verify keyword blocking works correctly
- [ ] Test caching mechanism (24-hour cache)
- [ ] Ensure privacy policy is accessible

## Required Assets for Submission

### Extension Package
- [ ] Create a ZIP file containing all extension files
  - manifest.json
  - background.js
  - content_script.js
  - options.html
  - options.js
  - lists.js
  - privacy.html
  - BubbleShield16.png
  - BubbleShield48.png
  - BubbleShield128.png
  - README.md (optional but recommended)

**Important:** Do NOT include:
- .git directory
- .gitignore
- node_modules (if any)
- Development files or build scripts
- CHROME_STORE_LISTING.md
- SUBMISSION_CHECKLIST.md (this file)

### Store Listing Images
- [ ] Create 3-5 screenshots (1280x800 or 640x400 recommended)
  - Screenshot 1: Extension filtering tweets on Twitter/X timeline
  - Screenshot 2: Options page showing keyword configuration
  - Screenshot 3: Privacy policy or how it works
  - Screenshot 4: Example of filtered timeline (before/after)
  - Screenshot 5: Extension icon and branding

- [ ] Create Promotional Tile (440x280, required)
- [ ] Create Small Tile (440x280, optional)
- [ ] Create Marquee Tile (1400x560, optional but recommended)

### Privacy Policy
- [ ] Host privacy.html on a public URL (required by Chrome Web Store)
  - Option 1: Create GitHub Pages repository and upload privacy.html
  - Option 2: Host on your own website
  - Option 3: Use a service like Netlify/Vercel for free hosting
- [ ] Update manifest.json with "homepage_url" pointing to privacy policy (optional)
- [ ] Test that privacy policy URL is accessible

## Chrome Web Store Developer Account
- [ ] Create Chrome Web Store Developer account (one-time $5 fee)
  - Visit: https://chrome.google.com/webstore/devconsole
  - Sign in with Google account
  - Pay $5 registration fee

## Store Listing Information
- [ ] Extension name: "Bubble Shield"
- [ ] Summary (132 chars): Ready in CHROME_STORE_LISTING.md
- [ ] Detailed description: Ready in CHROME_STORE_LISTING.md
- [ ] Category: Social & Communication
- [ ] Language: English
- [ ] Privacy policy URL: [TO BE ADDED after hosting]
- [ ] Support email: BubbleShieldApp@proton.me
- [ ] Website URL (optional): [Add if available]

## Permissions Justification
Prepare clear explanations for each permission:
- [ ] **storage**: "Used to save user-configured blocked keywords and cache profile bio data locally for 24 hours to improve performance."
- [ ] **host_permissions**: "Required to run the content script that filters tweets on Twitter/X websites. The extension only works on these domains."

## Single Purpose Statement
- [ ] "Bubble Shield serves a single purpose: filtering tweets on Twitter/X based on keywords found in the author's profile bio, with all processing happening locally on the user's device."

## Testing Checklist
- [ ] Load extension in Chrome (chrome://extensions)
- [ ] Enable Developer Mode
- [ ] Click "Load unpacked" and select extension folder
- [ ] Verify extension icon appears in toolbar
- [ ] Visit twitter.com or x.com
- [ ] Open options page and add test keywords
- [ ] Verify tweets are filtered based on bio keywords
- [ ] Check that filtered tweets are hidden with CSS
- [ ] Test cache functionality (same user should not be re-checked)
- [ ] Clear cache and verify re-checking works
- [ ] Test on both twitter.com and x.com domains
- [ ] Check browser console for any errors
- [ ] Test with different keyword combinations
- [ ] Verify privacy policy page loads correctly

## Final Pre-Submission Steps
- [ ] Remove or minimize console.log statements (optional - errors can stay)
- [ ] Bump version number if this is an update (currently 1.0.0)
- [ ] Create clean ZIP file (no extra files)
- [ ] Verify ZIP file size is reasonable (<10MB)
- [ ] Test ZIP file by loading in fresh Chrome instance

## Submission Process
1. [ ] Go to Chrome Web Store Developer Dashboard
2. [ ] Click "New Item"
3. [ ] Upload your ZIP file
4. [ ] Fill in store listing details from CHROME_STORE_LISTING.md
5. [ ] Upload all required images (screenshots, tiles)
6. [ ] Add privacy policy URL
7. [ ] Fill in permission justifications
8. [ ] Add single purpose description
9. [ ] Select category: Social & Communication
10. [ ] Set pricing (Free)
11. [ ] Select distribution (Public or Unlisted)
12. [ ] Review all information
13. [ ] Submit for review

## Post-Submission
- [ ] Review will take 1-3 business days (sometimes longer)
- [ ] Watch for emails from Chrome Web Store team
- [ ] Respond to any requests for clarification
- [ ] If rejected, address issues and resubmit

## Common Rejection Reasons to Avoid
- [ ] Vague or missing permission justifications
- [ ] Privacy policy not accessible or incomplete
- [ ] Screenshots not showing actual functionality
- [ ] Extension name or description too generic
- [ ] Requesting unnecessary permissions
- [ ] Single purpose violation (doing too many things)

## Additional Notes
- Chrome Web Store requires a publicly accessible privacy policy URL
- The extension is currently set to version 1.0.0
- All processing is local - emphasize this in listings
- Support email is BubbleShieldApp@proton.me
- Consider adding a website/landing page for better credibility

## How to Create the ZIP File
```bash
# From the extension directory, create a ZIP excluding unnecessary files
zip -r bubble-shield-v1.0.0.zip . -x "*.git*" "CHROME_STORE_LISTING.md" "SUBMISSION_CHECKLIST.md" "*.md"

# Or manually select only the required files:
zip bubble-shield-v1.0.0.zip manifest.json background.js content_script.js options.html options.js lists.js privacy.html BubbleShield16.png BubbleShield48.png BubbleShield128.png
```

## Quick Privacy Policy Hosting (GitHub Pages)
1. Create a new GitHub repository (e.g., "bubbleshield-privacy")
2. Upload privacy.html
3. Enable GitHub Pages in repository settings
4. Your privacy policy will be at: https://[username].github.io/bubbleshield-privacy/privacy.html
5. Update this URL in your Chrome Web Store listing

## Resources
- Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Chrome Web Store Developer Program Policies: https://developer.chrome.com/docs/webstore/program-policies
- Manifest V3 Documentation: https://developer.chrome.com/docs/extensions/mv3/intro/
