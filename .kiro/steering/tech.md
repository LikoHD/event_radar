# Technology Stack

## Core Technologies
- **Chrome Extension Manifest V3** - Modern extension architecture
- **Vanilla JavaScript** - No external dependencies or frameworks
- **HTML5 & CSS3** - Standard web technologies
- **Chrome APIs**:
  - `webRequest` - Network request interception
  - `sidePanel` - Side panel UI
  - `scripting` - Content script injection
  - `activeTab` - Current tab access
  - `clipboardWrite` - Copy functionality
  - `storage` - Data persistence

## Build System
- **No build system required** - Direct development with native web technologies
- **No package manager** - Zero dependencies approach
- **No compilation step** - Direct file editing and testing

## Development Workflow
```bash
# Install in Chrome (development mode)
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked extension"
4. Select the tea_event_radar folder

# Testing
- Load extension and test in browser
- Use Chrome DevTools for debugging
- Check extension console in chrome://extensions/

# Packaging
- Create ZIP file of tea_event_radar folder for distribution
```

## Code Style & Patterns
- **ES6+ JavaScript** with modern syntax
- **Async/await** for asynchronous operations
- **Event-driven architecture** using Chrome extension messaging
- **Performance optimization** with debouncing and throttling
- **Memory management** with event limits and cleanup
- **Error handling** with try-catch blocks and fallbacks

## External Resources
- **RemixIcon CDN** - Icon library (https://cdn.jsdelivr.net/npm/remixicon@2.5.0/fonts/remixicon.css)
- **No other external dependencies**