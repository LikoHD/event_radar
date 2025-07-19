# Project Structure

## Root Directory
```
tea_event_radar/           # Main extension directory
├── manifest.json          # Extension configuration (Manifest V3)
├── service-worker.js      # Background script for request interception
├── content-script.js      # Injected script for page interaction
├── panel.html            # Side panel UI structure
├── panel.js              # Side panel logic and event handling
├── panel.css             # Side panel styling (shadcn-inspired)
├── in-page-panel.css     # Alternative in-page panel styles
├── images/               # Extension icons and assets
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── kong.png          # Empty state illustration
└── README.md             # Project documentation
```

## Architecture Components

### Core Files
- **manifest.json** - Extension permissions, APIs, and entry points
- **service-worker.js** - Background process handling network requests and data storage
- **panel.js** - Main UI logic, event rendering, and user interactions
- **content-script.js** - Page-level script for notifications and messaging

### UI Components
- **panel.html** - Side panel structure with search, controls, and event list
- **panel.css** - Modern styling using CSS custom properties and shadcn color system
- **in-page-panel.css** - Alternative styling for in-page panel mode

### Assets
- **images/** - Icon files for different sizes and empty state graphics

## File Naming Conventions
- **Kebab-case** for CSS files (`panel.css`, `in-page-panel.css`)
- **Kebab-case** for HTML files (`panel.html`)
- **Kebab-case** for JS files (`service-worker.js`, `content-script.js`)
- **Lowercase** for manifest and config files (`manifest.json`)
- **PascalCase** for image assets when descriptive (`icon16.png`)

## Code Organization Patterns
- **Single responsibility** - Each file has a clear, focused purpose
- **Event-driven communication** - Chrome extension messaging between components
- **Modular functions** - Utility functions grouped by purpose
- **Performance-first** - Debouncing, throttling, and memory management built-in
- **Error resilience** - Multiple fallback mechanisms for encoding and clipboard operations

## Development Guidelines
- Keep all extension files in `tea_event_radar/` directory
- Use relative paths for internal resources
- Follow Chrome Extension security policies (no inline scripts)
- Maintain Chinese language support in comments and UI text