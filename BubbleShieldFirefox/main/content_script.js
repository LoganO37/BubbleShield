/**
 * Content Script for Bubble Shield (content_script.js)
 *
 * This script runs on Twitter/X pages and:
 * 1. Monitors the timeline for tweet elements using MutationObserver
 * 2. Extracts author usernames from tweet elements
 * 3. Triggers hover cards to extract author bios
 * 4. Checks if bios contain blocked keywords
 * 5. Hides tweets from blocked users
 *
 * All processing happens in the content script for maximum efficiency.
 * The hovercard inherits the username context from the base tweet element.
 */

// Cross-browser compatibility: Use browser namespace (Firefox) or chrome namespace (Chrome/Edge)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Debug logging function

// Debug statistics
const debugStats = {
  tweetsScanned: 0,
  tweetsProcessed: 0,
  tweetsHidden: 0,
  biosExtracted: 0,
  cacheHits: 0,
  errors: 0,
  lastError: null,
  startTime: Date.now()
};

// Debug logging function
function debugLog(message, data = null) {
  // Simple console logging
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  if (data) {
    console.log(`[${timestamp}] [Bubble Shield] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [Bubble Shield] ${message}`);
  }
}

// Cache for bio checks
// Structure: Map<username, { bio: string, blocked: boolean|string, timestamp: number }>
// blocked is either false (not blocked) or the keyword string that caused the block
const bioCache = new Map();

// Cache TTL: 48 hours in milliseconds
const CACHE_TTL = 48 * 60 * 60 * 1000;

// CSS class to mark hidden tweets
const HIDDEN_CLASS = 'twitter-bio-filter-hidden';

// Attribute to mark processed tweets
const PROCESSED_ATTR = 'data-bio-filter-processed';

// Blocked keywords (loaded from storage)
let blockedKeywords = [];
// Blocked phrases (loaded from storage)
let blockedPhrases = [];
// Whitelisted users (loaded from storage)
let whitelist = [];

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
 * Load blocked keywords from storage
 */
async function loadBlockedKeywords() {
  try {
    const result = await browserAPI.storage.sync.get(['blockedKeywords', 'blockedPhrases', 'whitelist', 'debugMode']);
    const keywords = result.blockedKeywords || [];
    const phrases = result.blockedPhrases || [];
    const whitelistedUsers = result.whitelist || [];

    // Normalize all keywords for consistent matching
    blockedKeywords = keywords.map(kw => normalizeText(kw)).filter(kw => kw.length > 0);

    // Normalize phrases
    blockedPhrases = phrases.map(p => normalizeText(p)).filter(p => p.length > 0);

    // Normalize whitelist (lowercase usernames)
    whitelist = whitelistedUsers.map(u => normalizeText(u.replace('@', ''))).filter(u => u.length > 0);

    debugLog(`Loaded ${blockedKeywords.length} blocked keywords, ${blockedPhrases.length} blocked phrases, and ${whitelist.length} whitelisted users`);
  } catch (error) {
    debugStats.errors++;
    debugStats.lastError = error.message;
    console.error('[Bubble Shield] Error loading blocked keywords:', error);
    blockedKeywords = [];
  }
}

/**
 * Inject CSS to hide filtered tweets and add debug panel styles
 */
function injectStyles() {
  if (document.getElementById('twitter-bio-filter-styles')) {
    return; // Already injected
  }

  const style = document.createElement('style');
  style.id = 'twitter-bio-filter-styles';
  style.textContent = `
    .${HIDDEN_CLASS} {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
  document.head.appendChild(style);
  document.head.appendChild(style);
  debugLog('Styles injected');
}

/**
 * Inject floating icon to open options page
 */
function injectFloatingIcon() {
  if (document.getElementById('bubble-shield-floating-icon')) {
    return;
  }

  const iconContainer = document.createElement('div');
  iconContainer.id = 'bubble-shield-floating-icon';
  iconContainer.title = 'Bubble Shield Settings';

  iconContainer.onclick = () => {
    browserAPI.runtime.sendMessage({ action: 'openOptions' });
  };

  // Style the container
  Object.assign(iconContainer.style, {
    position: 'fixed',
    bottom: '160px', // Positioned above typical bottom-right icons
    right: '24px',
    width: '50px',
    height: '35px',
    zIndex: '9999',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s ease',
    textDecoration: 'none' // Remove underline from anchor
  });

  // Add hover effect
  iconContainer.onmouseenter = () => {
    iconContainer.style.transform = 'scale(1.1)';
  };
  iconContainer.onmouseleave = () => {
    iconContainer.style.transform = 'scale(1.0)';
  };

  const img = document.createElement('img');
  img.src = browserAPI.runtime.getURL('BubbleShield128.png');
  Object.assign(img.style, {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))'
  });

  iconContainer.appendChild(img);
  document.body.appendChild(iconContainer);
  debugLog('Floating icon injected');
}






/**
 * Queue system to limit concurrent bio fetches
 * Prevents "mouse fighting" and excessive resource usage
 */
class BioFetchQueue {
  constructor(concurrency = 1) {
    this.queue = [];
    this.active = 0;
    this.concurrency = concurrency;
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.active >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.active++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.active--;
      this.process();
    }
  }
}

// Initialize queue with concurrency of 1
// This ensures only one bio is fetched at a time to prevent race conditions
// where multiple requests read from the same hover card
const bioQueue = new BioFetchQueue(1);

// IntersectionObserver to only process visible tweets
const tweetObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const tweetElement = entry.target;
      // Stop observing once visible to avoid repeated processing
      tweetObserver.unobserve(tweetElement);
      processTweet(tweetElement);
    }
  });
}, {
  root: null, // viewport
  rootMargin: '800px', // Pre-load well before they enter viewport (approx 1-2 screens)
  threshold: 0.1
});


/**
 * Extract username from a URL (relative or absolute)
 * @param {string} href - The URL to parse
 * @returns {string|null} The username or null if invalid/ignored
 */
function extractUsernameFromHref(href) {
  if (!href) return null;

  try {
    const url = new URL(href, document.baseURI);
    const pathname = url.pathname;

    // Skip non-profile links
    if (pathname.includes('/status/') ||
      pathname.includes('/i/') ||
      pathname.includes('/search') ||
      pathname.includes('/hashtag/') ||
      pathname === '/' ||
      pathname === '/home' ||
      pathname === '/explore' ||
      pathname === '/notifications' ||
      pathname === '/messages' ||
      pathname === '/bookmarks' ||
      pathname === '/settings') {
      return null;
    }

    // Extract username (format: /username or /username/with_replies etc)
    // We only want the first segment
    const match = pathname.match(/^\/([a-zA-Z0-9_]+)/);
    if (match) {
      return match[1];
    }
  } catch (e) {
    // Invalid URL
  }
  return null;
}


/**
 * Extract username from a tweet element
 * @param {Element} tweetElement - The article element containing a tweet
 * @returns {string|null} The username or null if not found
 */
function extractUsername(tweetElement) {
  try {
    debugLog('Extracting username from tweet');

    // Look for the author's profile link
    // We use role="link" and filter by href content instead of relying on href^="/"
    // because hrefs can be absolute (e.g. https://x.com/username)
    const selectors = [
      'a[role="link"]:not([href*="/status/"]):not([href*="/i/"])',
      'div[data-testid="User-Name"] a[role="link"]',
    ];

    for (const selector of selectors) {
      const links = tweetElement.querySelectorAll(selector);
      // debugLog(`Found ${links.length} links with selector: ${selector}`);

      for (const link of links) {
        const href = link.getAttribute('href');
        const username = extractUsernameFromHref(href);

        if (username) {
          debugLog(`✓ Extracted username: @${username}`);
          return username;
        }
      }
    }

    debugLog('✗ Could not extract username');
    return null;
  } catch (error) {
    debugStats.errors++;
    debugStats.lastError = `extractUsername: ${error.message}`;
    console.error('[Bubble Shield] Error extracting username:', error);
    return null;
  }
}

/**
 * Extract the display name from a tweet
 * @param {Element} tweetElement - The article element containing a tweet
 * @returns {string|null} The display name or null if not found
 */
function extractDisplayName(tweetElement) {
  try {
    // Find the User-Name div
    const userNameDiv = tweetElement.querySelector('div[data-testid="User-Name"]');
    if (!userNameDiv) return null;

    // The display name is usually in the first link, inside a span
    // Structure: div[User-Name] -> div -> div -> a -> div -> div -> span -> span[text]
    // Or simpler: just get the text content of the first anchor tag, but that might include the handle if they are close?
    // Actually, in the User-Name div, there are usually two links: one for display name, one for handle.
    // The display name is the first one.

    const links = userNameDiv.querySelectorAll('a[role="link"]');
    if (links.length > 0) {
      // The first link is usually the display name
      // But we need to be careful not to get the handle if it's somehow mixed
      // The display name link usually contains the text directly
      const displayNameLink = links[0];

      // Extract text, including alt text from images (Twemojis)
      let text = '';

      // Clone to handle images safely
      const clone = displayNameLink.cloneNode(true);
      const images = clone.querySelectorAll('img');
      for (const img of images) {
        const alt = img.getAttribute('alt');
        if (alt) {
          const textNode = document.createTextNode(alt);
          img.parentNode.replaceChild(textNode, img);
        }
      }

      text = clone.textContent;

      if (text) {
        // debugLog(`Extracted display name: "${text}"`);
        return text;
      }
    }

    return null;
  } catch (error) {
    console.error('[Bubble Shield] Error extracting display name:', error);
    return null;
  }
}

/**
 * Get the profile link element from a tweet
 * @param {Element} tweetElement - The article element containing a tweet
 * @returns {Element|null} The link element or null
 */
function getProfileLink(tweetElement) {
  try {
    debugLog('Getting profile link element');

    // Strategy 1: Look for the avatar link (usually more reliable for hovering)
    const avatarLink = tweetElement.querySelector('[data-testid="Tweet-User-Avatar"] a');
    if (avatarLink) {
      debugLog('✓ Found profile link (avatar)');
      return avatarLink;
    }

    // Strategy 2: Look for the User-Name link
    const userNameDiv = tweetElement.querySelector('div[data-testid="User-Name"]');
    if (userNameDiv) {
      // Find any link that looks like a profile link
      const links = userNameDiv.querySelectorAll('a[role="link"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (extractUsernameFromHref(href)) {
          debugLog('✓ Found profile link (name)');
          return link;
        }
      }
    }

    debugLog('✗ Profile link not found');
    return null;
  } catch (error) {
    debugStats.errors++;
    debugStats.lastError = `getProfileLink: ${error.message}`;
    console.error('[Bubble Shield] Error getting profile link:', error);
    return null;
  }
}

/**
 * Wait for hover card content to be populated
 * @param {Element} hoverCard - The hover card element
 * @param {string} username - The username
 * @returns {Promise<string|null>} The bio text, or null if timeout
 */
function waitForHoverCardContent(hoverCard, username) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      debugLog(`✗ Hover card content timeout for @${username}`);
      contentObserver.disconnect();
      // Try one last time before giving up
      const bio = extractBioFromHoverCard(hoverCard, username);
      // Clean up the hover card
      if (hoverCard && hoverCard.parentNode) {
        debugLog('Removing timed-out hover card from DOM');
        hoverCard.remove();
      }
      resolve(bio);
    }, 2000); // 2 second timeout for content to load

    // Try extracting immediately first
    let bio = extractBioFromHoverCard(hoverCard, username);
    if (bio !== null && bio !== '') {
      clearTimeout(timeout);
      // Clean up hover card after successful extraction
      if (hoverCard && hoverCard.parentNode) {
        debugLog('Removing hover card from DOM after immediate extraction');
        hoverCard.remove();
      }
      resolve(bio);
      return;
    }

    // If empty or null, wait for content to be added
    debugLog('Hover card is empty, waiting for content to be added...');
    const contentObserver = new MutationObserver(() => {
      bio = extractBioFromHoverCard(hoverCard, username);
      if (bio !== null && bio !== '') {
        debugLog('✓ Hover card content loaded');
        clearTimeout(timeout);
        contentObserver.disconnect();
        // Clean up hover card after successful extraction
        if (hoverCard && hoverCard.parentNode) {
          debugLog('Removing hover card from DOM after delayed extraction');
          hoverCard.remove();
        }
        resolve(bio);
      }
    });

    contentObserver.observe(hoverCard, {
      childList: true,
      subtree: true
    });
  });
}

/**
 * Wait for hover card to appear and extract bio
 * @param {string} username - The username to look for
 * @returns {Promise<string|null>} The bio text, or null if timeout/not found
 */
function waitForHoverCardBio(username) {
  debugLog(`Waiting for hover card for @${username}`);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      debugLog(`✗ Hover card timeout for @${username}`);
      observer.disconnect();
      resolve(null); // Return null on timeout to indicate failure
    }, 8000); // 8 second timeout for hover card to appear

    // Look for existing hover card first
    const existingCard = document.querySelector('[data-testid="HoverCard"]');
    if (existingCard) {
      debugLog('Found existing hover card, waiting for content...');
      clearTimeout(timeout);
      waitForHoverCardContent(existingCard, username).then(resolve);
      return;
    }

    // Watch for hover card to appear
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            // Check if this is a hover card
            const hoverCard = node.querySelector ? node.querySelector('[data-testid="HoverCard"]') : null;
            const isHoverCard = node.getAttribute && node.getAttribute('data-testid') === 'HoverCard';

            if (hoverCard || isHoverCard) {
              debugLog('✓ Hover card appeared in DOM, waiting for content...');
              clearTimeout(timeout);
              observer.disconnect();
              const cardElement = hoverCard || node;
              waitForHoverCardContent(cardElement, username).then(resolve);
              return;
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    debugLog('MutationObserver watching for hover card');
  });
}

/**
 * Extract bio from a hover card element
 * @param {Element} hoverCard - The hover card element
 * @param {string} username - Username inherited from the tweet element (for logging only)
 * @returns {string|null} The bio text or null if not found
 */
function extractBioFromHoverCard(hoverCard, username) {
  try {
    debugLog(`Extracting bio from hover card for @${username} (trusting page context)`);

    // Basic sanity check: verify username appears somewhere in the hover card
    // This prevents reading the wrong hover card in race conditions
    const hoverCardText = hoverCard.textContent.toLowerCase();
    const usernameNormalized = username.toLowerCase();
    if (!hoverCardText.includes(usernameNormalized) && !hoverCardText.includes('@' + usernameNormalized)) {
      debugLog(`⚠️ Username @${username} not found in hover card text - likely wrong hover card (race condition)`);
      return null; // Return null to trigger retry
    }

    // Try to find the bio element
    // Strategy 1: Standard testid (often missing in new UI)
    let bioElement = hoverCard.querySelector('[data-testid="UserDescription"]');

    // Strategy 2: Look for div[dir="auto"] which usually contains the bio
    if (!bioElement) {
      const autoDirDivs = hoverCard.querySelectorAll('div[dir="auto"]');
      debugLog(`Found ${autoDirDivs.length} div[dir="auto"] elements in hover card`);

      for (let i = 0; i < autoDirDivs.length; i++) {
        const div = autoDirDivs[i];

        // Skip hidden elements (like the "Click to Follow" tooltip)
        if (div.style.display === 'none') {
          debugLog(`  [${i}] Skipped: hidden (display:none)`);
          continue;
        }

        const text = div.textContent.trim();
        const textLower = text.toLowerCase();
        debugLog(`  [${i}] Text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

        // Skip "Click to Follow" tooltip
        if (textLower.startsWith('click to follow')) {
          debugLog(`  [${i}] Skipped: "Click to Follow" tooltip`);
          continue;
        }

        // Skip if it's just the handle (with or without @)
        if (textLower === '@' + username.toLowerCase() || textLower === username.toLowerCase()) {
          debugLog(`  [${i}] Skipped: matches username`);
          continue;
        }

        // Skip if it's likely the display name (short, no punctuation usually, but hard to be sure)
        // We can't easily distinguish display name from a short bio without more context.
        // But usually display name is in a specific structure.
        // For now, we'll assume if it passed the above checks, it's a candidate.

        // The bio usually has specific classes or is just a text container
        // In the provided HTML, it's a div[dir="auto"] inside a wrapper
        // We'll take the first visible div[dir="auto"] that isn't the tooltip or handle
        debugLog(`  [${i}] ✓ Selected as bio element`);
        bioElement = div;
        break;
      }
    }

    // Strategy 3: Fallback - look for any text content that might be the bio
    // Sometimes the bio is in a span or other element without dir="auto"
    if (!bioElement) {
      debugLog('Strategy 3: Looking for bio with fallback selectors...');

      // Look for common bio container patterns
      const possibleBioSelectors = [
        '[data-testid="UserProfileHeader_Items"] > div > span',
        'div[data-testid="UserDescription"] span',
        // Add more selectors as needed
      ];

      for (const selector of possibleBioSelectors) {
        const element = hoverCard.querySelector(selector);
        if (element && element.textContent.trim()) {
          debugLog(`Found bio using selector: ${selector}`);
          bioElement = element;
          break;
        }
      }
    }

    // Extract text from bio element (if found)
    if (bioElement) {
      // Extract text, including alt text from images (Twemojis)
      let bioText = '';

      // Clone the node to avoid modifying the DOM
      const clone = bioElement.cloneNode(true);

      // Replace all images with their alt text
      const images = clone.querySelectorAll('img');
      for (const img of images) {
        const alt = img.getAttribute('alt');
        if (alt) {
          const textNode = document.createTextNode(alt);
          img.parentNode.replaceChild(textNode, img);
        }
      }

      bioText = clone.textContent.trim();
      debugLog(`✓ Bio extracted (${bioText.length} chars): "${bioText.substring(0, 50)}..."`);
      debugStats.biosExtracted++;
      return bioText;
    }

    // No bio found (user might have empty bio)
    debugLog(`✗ No bio element found after all strategies - user may have empty bio or DOM structure changed`);
    debugLog(`DEBUG: Hover card HTML structure (first 1500 chars):`);
    debugLog(hoverCard.innerHTML.substring(0, 1500));
    debugLog(`DEBUG: Hover card testids found:`);
    const testidElements = hoverCard.querySelectorAll('[data-testid]');
    testidElements.forEach(el => {
      debugLog(`  - data-testid="${el.getAttribute('data-testid')}" tag="${el.tagName}"`);
    });
    return '';
  } catch (error) {
    debugStats.errors++;
    debugStats.lastError = `extractBioFromHoverCard: ${error.message}`;
    console.error('[Bubble Shield] Error extracting bio from hover card:', error);
    return null;
  }
}

/**
 * Get user bio by triggering hover card
 * @param {Element} tweetElement - The tweet element
 * @param {string} username - The username
 * @returns {Promise<string|null>} The bio text, or null if failed
 */
async function getUserBio(tweetElement, username) {
  // Check cache first
  const cached = bioCache.get(username);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    debugLog(`✓ Cache hit for @${username}`);
    debugStats.cacheHits++;
    return cached.bio;
  }

  debugLog(`Cache miss for @${username}, triggering hover card`);

  try {
    // Get the profile link to trigger hover on
    const profileLink = getProfileLink(tweetElement);
    if (!profileLink) {
      debugLog(`✗ Could not find profile link for @${username}`);
      return null;
    }

    // Retry logic
    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        debugLog(`Retry attempt ${attempt}/${MAX_RETRIES} for @${username}`);
        // Small delay before retry
        await new Promise(r => setTimeout(r, 500));
      }

      // Trigger hover event
      debugLog(`Dispatching hover events (attempt ${attempt})`);

      // Get coordinates to make the event look real
      const rect = profileLink.getBoundingClientRect();
      const clientX = rect.left + (rect.width / 2);
      const clientY = rect.top + (rect.height / 2);

      const eventOptions = {
        view: window,
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: clientX,
        clientY: clientY,
        screenX: clientX, // Approximation
        screenY: clientY,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
      };

      // Sequence of events to mimic a real mouse hover
      // Modern Twitter/React often listens to pointer events
      const eventTypes = [
        { type: 'pointerover', class: PointerEvent },
        { type: 'mouseover', class: MouseEvent },
        { type: 'pointerenter', class: PointerEvent },
        { type: 'mouseenter', class: MouseEvent },
        { type: 'pointermove', class: PointerEvent },
        { type: 'mousemove', class: MouseEvent },
        { type: 'focus', class: FocusEvent } // Add focus
      ];

      eventTypes.forEach(evt => {
        const event = new evt.class(evt.type, eventOptions);
        profileLink.dispatchEvent(event);
      });

      // Wait for hover card to appear and extract bio
      const bio = await waitForHoverCardBio(username);

      // If successful, process and return
      if (bio !== null) {
        // Cache the result (including empty bios)
        bioCache.set(username, {
          bio,
          blocked: containsBlockedKeyword(bio),
          timestamp: now
        });

        debugLog(`✓ Cached bio for @${username}`);

        // Forcefully close the hover card by removing it from DOM
        const hoverCard = document.querySelector('[data-testid="HoverCard"]');
        if (hoverCard) {
          debugLog('Removing hover card from DOM');
          hoverCard.remove();
        }

        // Also trigger mouse leave events as backup
        const leaveEventTypes = [
          { type: 'pointerout', class: PointerEvent },
          { type: 'mouseout', class: MouseEvent },
          { type: 'pointerleave', class: PointerEvent },
          { type: 'mouseleave', class: MouseEvent },
          { type: 'blur', class: FocusEvent }
        ];

        leaveEventTypes.forEach(evt => {
          const event = new evt.class(evt.type, eventOptions);
          profileLink.dispatchEvent(event);
        });

        // Wait a moment before returning to ensure cleanup
        await new Promise(r => setTimeout(r, 100));

        return bio;
      }

      // If failed, loop will retry
      debugLog(`✗ Attempt ${attempt} failed for @${username}`);
    }

    // All retries failed
    debugLog(`✗ All ${MAX_RETRIES} attempts failed for @${username}, not caching`);
    return null;
  } catch (error) {
    debugStats.errors++;
    debugStats.lastError = `getUserBio: ${error.message}`;
    console.error(`[Bubble Shield] Error getting bio for @${username}:`, error);
    return null;
  }
}

/**
 * Check if text contains any blocked keywords
 * Performs case-insensitive partial matching
 * @param {string} text - The text to check (bio, username, etc)
 * @returns {string|boolean} The matching keyword if found, otherwise false
 */
function containsBlockedKeyword(text) {
  if (!text || blockedKeywords.length === 0) {
    return false;
  }

  // Normalize text for consistent matching
  const textNormalized = normalizeText(text);

  debugLog(`Checking text against ${blockedKeywords.length} keyword(s): "${text}"`);

  for (const keyword of blockedKeywords) {
    // Keywords are already normalized in loadBlockedKeywords
    // Using .includes() for partial/substring matching
    if (textNormalized.includes(keyword)) {
      // Find the actual matched portion in the original text
      // This is tricky because normalization changes indices
      // We'll just report the keyword match for now

      // Try to find approximate context in original text
      // Simple case-insensitive search for context
      const matchIndex = text.toLowerCase().indexOf(keyword.toLowerCase()); // Fallback for context
      let context = "";
      let matchedText = keyword;

      if (matchIndex !== -1) {
        matchedText = text.substring(matchIndex, matchIndex + keyword.length);
        const contextStart = Math.max(0, matchIndex - 20);
        const contextEnd = Math.min(text.length, matchIndex + keyword.length + 20);
        context = text.substring(contextStart, contextEnd);
      } else {
        context = "(normalized match)";
      }

      debugLog(`🚫 MATCH FOUND! Keyword: "${keyword}" matched "${matchedText}" in context: "...${context}..."`);
      return keyword;
    }
  }

  debugLog(`✓ No blocked keywords found in text`);
  return false;
}

/**
 * Check if text contains any blocked phrases
 * Performs case-insensitive partial matching
 * @param {string} text - The text to check
 * @returns {string|boolean} The matching phrase if found, otherwise false
 */
function containsBlockedPhrase(text) {
  if (!text || blockedPhrases.length === 0) {
    return false;
  }

  const textNormalized = normalizeText(text);

  for (const phrase of blockedPhrases) {
    if (textNormalized.includes(phrase)) {
      debugLog(`🚫 PHRASE MATCH! Phrase: "${phrase}" matched in text`);
      return phrase;
    }
  }

  return false;
}

/**
 * Check if a user should be blocked based on cached data
 * @param {string} username - The username
 * @returns {string|boolean|null} Keyword if blocked, false if allowed, null if not cached
 */
function isUserBlockedFromCache(username) {
  const cached = bioCache.get(username);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.blocked;
  }

  return null;
}

/**
 * Process a single tweet element
 * @param {Element} tweetElement - The article element containing a tweet
 */
async function processTweet(tweetElement) {
  // Skip if already processed
  if (tweetElement.hasAttribute(PROCESSED_ATTR)) {
    return;
  }

  debugStats.tweetsProcessed++;
  debugLog(`\n=== Processing tweet #${debugStats.tweetsProcessed} ===`);

  // Mark as processed immediately to avoid re-processing
  tweetElement.setAttribute(PROCESSED_ATTR, 'true');

  try {
    // Extract username
    const username = extractUsername(tweetElement);

    if (!username) {
      debugLog('✗ Skipping tweet - could not extract username');
      return;
    }



    // Check whitelist first
    if (whitelist.includes(normalizeText(username))) {
      debugLog(`✓ Allowing tweet from @${username} (whitelisted)`);
      return;
    }

    // Check cache first (fast path)
    const cachedBlocked = isUserBlockedFromCache(username);
    if (cachedBlocked) {
      tweetElement.classList.add(HIDDEN_CLASS);
      debugStats.tweetsHidden++;
      debugLog(`🚫 Hid tweet from @${username} (cached as blocked by: "${cachedBlocked}")`);
      return;
    } else if (cachedBlocked === false) {
      debugLog(`✓ Allowing tweet from @${username} (cached as allowed)`);
      return;
    }

    // Check if username itself is blocked
    const usernameBlock = containsBlockedKeyword(username);
    if (usernameBlock) {
      tweetElement.classList.add(HIDDEN_CLASS);
      debugStats.tweetsHidden++;
      debugLog(`🚫 Hid tweet from @${username} (username matched: "${usernameBlock}")`);
      // Cache as blocked
      bioCache.set(username, {
        bio: '', // No bio needed
        blocked: usernameBlock,
        timestamp: Date.now()
      });
      return;
    }

    // Check if display name is blocked
    const displayName = extractDisplayName(tweetElement);
    if (displayName) {
      const displayNameBlock = containsBlockedKeyword(displayName);
      if (displayNameBlock) {
        tweetElement.classList.add(HIDDEN_CLASS);
        debugStats.tweetsHidden++;
        debugLog(`🚫 Hid tweet from @${username} (display name "${displayName}" matched: "${displayNameBlock}")`);
        // Cache as blocked
        bioCache.set(username, {
          bio: '', // No bio needed
          blocked: displayNameBlock, // Store the keyword
          timestamp: Date.now()
        });
        return;
      }
    }

    // Check tweet content for blocked phrases
    // We need to extract the tweet text content
    // Usually in div[data-testid="tweetText"]
    const tweetTextElement = tweetElement.querySelector('div[data-testid="tweetText"]');
    if (tweetTextElement) {
      const tweetText = tweetTextElement.textContent;
      const phraseBlock = containsBlockedPhrase(tweetText);

      if (phraseBlock) {
        tweetElement.classList.add(HIDDEN_CLASS);
        debugStats.tweetsHidden++;
        debugLog(`🚫 Hid tweet from @${username} (phrase matched: "${phraseBlock}")`);
        // IMPORTANT: Do NOT cache user as blocked for phrase match
        // We only hide this specific tweet
        return;
      }
    }

    // Not in cache, need to fetch bio from hover card
    debugLog(`Fetching bio for @${username}...`);

    // Use queue to limit concurrency
    const bio = await bioQueue.add(() => getUserBio(tweetElement, username));

    // If bio is null, the hover card failed - skip this tweet for now
    if (bio === null) {
      debugLog(`⚠️ Skipping @${username} - hover card failed to load`);
      // Remove processed attribute and observing flag so we can retry later
      tweetElement.removeAttribute(PROCESSED_ATTR);
      tweetElement.removeAttribute('data-bio-filter-observing');
      return;
    }

    const blockedKeyword = containsBlockedKeyword(bio);

    if (blockedKeyword) {
      tweetElement.classList.add(HIDDEN_CLASS);
      debugStats.tweetsHidden++;
      debugLog(`🚫 Hid tweet from @${username} (bio matched: "${blockedKeyword}")`);
    } else {
      // If the user is NOT blocked, check if this is a reply to a blocked user
      // This ensures we hide replies to hidden tweets for a seamless experience
      const replyingTo = extractReplyingTo(tweetElement);
      if (replyingTo) {
        // Check if the user being replied to is blocked (check cache only to avoid cascading fetches)
        const parentBlocked = isUserBlockedFromCache(replyingTo);
        if (parentBlocked) {
          tweetElement.classList.add(HIDDEN_CLASS);
          debugStats.tweetsHidden++;
          debugLog(`🚫 Hid reply from @${username} to blocked user @${replyingTo} (blocked by: "${parentBlocked}")`);
          return;
        }
      }

      debugLog(`✓ Allowing tweet from @${username}`);
    }
  } catch (error) {
    debugStats.errors++;
    debugStats.lastError = `processTweet: ${error.message}`;
    console.error('[Bubble Shield] Error processing tweet:', error);
    // Fail open - don't hide the tweet if something goes wrong
  }
}

/**
 * Extract the username being replied to from a tweet
 * @param {Element} tweetElement - The tweet element
 * @returns {string|null} The username being replied to, or null
 */
function extractReplyingTo(tweetElement) {
  try {
    // Look for "Replying to @username" text
    // This is usually in a div with text content starting with "Replying to"
    // We can look for links that start with @ inside the tweet header area

    // Strategy: Look for the "Replying to" container
    const links = tweetElement.querySelectorAll('a[href^="/"][role="link"]');
    for (const link of links) {
      // The "Replying to" link usually has text starting with @
      if (link.textContent.trim().startsWith('@')) {
        // Check if it's preceded by "Replying to" text in the parent/grandparent
        // This is a bit heuristic, but "Replying to" is usually in a specific context
        // A safer check: Is this link BEFORE the tweet content?
        // And is it NOT the author link?

        const href = link.getAttribute('href');
        const username = href.substring(1); // Remove leading /

        // We need to make sure this isn't the author themselves (e.g. in a thread)
        // But if the author is blocked, the tweet is already hidden.
        // So we are looking for OTHER users.

        // Actually, Twitter's DOM usually has a specific structure for "Replying to"
        // It's often: <div>Replying to <a href="/user">@user</a></div>

        const parentText = link.parentElement.textContent;
        if (parentText.includes('Replying to')) {
          return username;
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Scan for tweet elements and process them
 * Uses article[role="article"] as the selector (standard Twitter markup)
 */
function scanForTweets() {
  const tweetElements = document.querySelectorAll('article[role="article"]');
  debugStats.tweetsScanned += tweetElements.length;
  // debugLog(`Scanning ${tweetElements.length} tweet(s)`); // Reduce log noise

  for (const tweet of tweetElements) {
    // Skip if already processed or already observing
    if (tweet.hasAttribute(PROCESSED_ATTR) || tweet.hasAttribute('data-bio-filter-observing')) {
      continue;
    }

    // Mark as observing
    tweet.setAttribute('data-bio-filter-observing', 'true');

    // Observe visibility
    tweetObserver.observe(tweet);
  }
}

/**
 * Set up MutationObserver to detect new tweets as they're added
 */
function observeTimeline() {
  const observer = new MutationObserver((mutations) => {
    // Batch process to avoid excessive scanning
    let shouldScan = false;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }

    if (shouldScan) {
      scanForTweets();
    }
  });

  // Observe the entire document body for added nodes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  debugLog('✓ MutationObserver started - watching for new tweets');

  return observer;
}

/**
 * Initialize the content script
 */
async function initialize() {
  console.log('[Bubble Shield] Content script initializing...');

  // Load blocked keywords
  await loadBlockedKeywords();

  // Inject styles
  injectStyles();

  // Inject floating icon
  injectFloatingIcon();



  // Do initial scan
  scanForTweets();

  // Start observing for new tweets
  observeTimeline();

  // Listen for storage changes to clear cache when keywords are updated
  browserAPI.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.blockedKeywords || changes.blockedPhrases || changes.whitelist)) {
      debugLog('🔄 Settings changed, reloading...');

      // Reload keywords
      loadBlockedKeywords().then(() => {
        // Clear cache
        bioCache.clear();

        // Re-scan all tweets
        // First, remove processed attribute from all tweets
        document.querySelectorAll(`article[${PROCESSED_ATTR}]`).forEach(el => {
          el.removeAttribute(PROCESSED_ATTR);
          el.classList.remove(HIDDEN_CLASS);
        });

        // Reset stats
        debugStats.tweetsScanned = 0;
        debugStats.tweetsProcessed = 0;
        debugStats.tweetsHidden = 0;

        // Then scan again
        scanForTweets();
      });
    }
  });

  console.log('[Bubble Shield] ✓ Content script initialized');
  debugLog('=== INITIALIZATION COMPLETE ===');
}

// Wait for DOM to be ready and initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM is already ready
  initialize();
}
