# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension that monitors network requests (fetch and XMLHttpRequest) on web pages and automatically generates structured API documentation. The extension is written in Chinese and uses Manifest V3.

## Architecture

### Multi-Layer Request Interception

The extension uses a three-layer architecture to capture network requests:

1. **inject.js** - Injected into page context
   - Intercepts `window.fetch` and `XMLHttpRequest` at the JavaScript level
   - Posts captured requests to the content script via `window.postMessage`
   - Handles both JSON and text responses

2. **content.js** - Content script layer
   - Loads and injects inject.js into the page
   - Acts as a bridge between the page and background script

3. **background.js** - Service worker
   - Manages recording state and request storage
   - Uses Chrome Debugger API (`Network.enable`, `Network.responseReceived`, `Network.getResponseBody`) for comprehensive request capture
   - Implements deduplication logic via `isDuplicateRequest()` to prevent duplicate entries
   - Handles messages from both the debugger and injected scripts

### State Management

- Recording state and requests are stored in `chrome.storage.local`
- Both background.js and popup.js maintain their own `networkRequests` and `requests` arrays
- Communication between components uses `chrome.runtime.sendMessage` and `chrome.runtime.onMessage`

### Documentation Generation

- **popup.js** contains the core documentation generation logic:
  - `generateAPIDocumentation()` - Groups requests by method and path
  - `generateDocumentationHTML()` - Creates a standalone HTML document with embedded CSS
  - Documentation is opened in a new tab and includes response bodies, headers, and status codes

## Development

### Loading the Extension

Since this is not a typical Node.js project, there are no build scripts. To load the extension:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `page-api` directory

### Testing Changes

After making code changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension card
3. Reload any web pages where the extension is active

### Key Permissions

The extension requires:
- `debugger` - For accessing Network API to capture request/response details
- `storage` - For persisting recording state and requests
- `activeTab` - For interacting with the current tab
- `<all_urls>` - For injecting content scripts on all pages

## Important Implementation Details

### Request Deduplication

Requests are deduplicated in background.js by comparing:
- HTTP method
- URL
- Response body (JSON stringified)

### Debugger API Usage

When recording starts:
- Debugger attaches to the active tab with protocol version "1.2"
- Network domain is enabled via `Network.enable`
- Listener captures `Network.responseReceived` events
- Response bodies are fetched asynchronously with `Network.getResponseBody`

When recording stops:
- Debugger detaches from the tab
- Captured requests are returned to popup.js

### Message Flow

1. User clicks "Start Recording" in popup
2. popup.js → background.js: `{action: 'startRecording'}`
3. background.js attaches debugger and enables network tracking
4. Page makes API request
5. inject.js captures request → window.postMessage
6. background.js captures via debugger → stores in `networkRequests`
7. background.js → popup.js: `{action: 'requestCaptured', data: {...}}`
8. popup.js updates UI and local storage

## File Responsibilities

- **manifest.json** - Extension configuration, permissions, and entry points
- **background.js** - Recording state, debugger management, request storage, deduplication
- **content.js** - Simple bridge that injects inject.js
- **inject.js** - Page-level fetch/XHR interception
- **popup.html** - Extension popup UI structure
- **popup.js** - UI logic, documentation generation, local storage management
