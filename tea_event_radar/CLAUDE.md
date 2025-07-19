# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tea Event Radar is a Chrome extension (Manifest V3) that monitors and captures website event tracking data in real-time. It displays captured events in a browser side panel with search, filtering, and detailed inspection capabilities.

## Architecture

### Core Components

- **service-worker.js**: Background script that intercepts network requests using webRequest API, captures POST requests containing "list", handles event storage and state management
- **content-script.js**: Injected into web pages to handle UI notifications and communication between extension and web pages  
- **panel.html/js/css**: Side panel UI that displays captured events with search/filter functionality and resizable interface
- **in-page-panel.css**: Styles for the injected in-page panel overlay

### Data Flow

1. Service worker intercepts POST requests with "list" in URL
2. Request body is decoded (UTF-8 with fallback mechanisms for Chinese characters)
3. Events stored in `capturedEvents` array with timestamp, URL, request data, headers, and status
4. Panel UI updates via message passing between service worker and panel
5. Users can start/pause capture, search/filter events, and inspect detailed event data

### Key Features

- **Network Interception**: Captures埋点 (tracking/analytics) data from POST requests
- **Chinese Character Support**: Multi-layer decoding (UTF-8 → URL decode → Latin-1 fallback)
- **Expandable Cards**: Event list with collapsible detailed views
- **Search & Filter**: Multi-keyword search with include/exclude modes
- **Resizable Panel**: Draggable width adjustment (280px-800px range)
- **Clipboard Integration**: Copy event data with fallback mechanisms

## Development Commands

This is a vanilla JavaScript Chrome extension with no build process. Development workflow:

1. **Load Extension**: Chrome → Extensions → Developer Mode → "Load unpacked" → select project folder
2. **Reload Extension**: After code changes, click reload button in chrome://extensions/
3. **Debug**: Use Chrome DevTools on extension pages, check service worker logs in Extensions page
4. **Test**: Install extension, navigate to websites with tracking, verify events are captured

## Manifest V3 Permissions

- `webRequest`: Intercept network requests for埋点 data
- `sidePanel`: Display extension UI in browser side panel  
- `scripting`: Inject content scripts and CSS
- `activeTab`: Access current tab for notifications
- `clipboardWrite`: Copy event data to clipboard
- `host_permissions: ["<all_urls>"]`: Monitor requests on all websites

## Message Passing

Extension uses Chrome's runtime messaging:
- Service worker ↔ Panel: Event data updates, capture control
- Service worker ↔ Content script: UI notifications, panel operations
- Actions: `getEvents`, `clearEvents`, `startCapturing`, `stopCapturing`, `updateEvents`

## State Management

- `capturedEvents[]`: Array of event objects with ID, timestamp, URL, request data, headers, status
- `isCapturing`: Boolean flag controlling request interception
- `expandedCards`: UI state for which event cards are expanded
- `searchKeywords[]`: Active search terms for filtering events