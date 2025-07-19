# Product Overview

Tea Event Radar is a Chrome browser extension designed for monitoring and analyzing web analytics tracking data. It captures real-time tracking events from web pages and displays them in a clean, intuitive browser side panel.

## Core Purpose
- Monitor web page tracking/analytics requests (primarily POST requests containing "list")
- Provide real-time visualization of tracking events for developers and testers
- Enable easy debugging and analysis of analytics implementation

## Key Features
- Real-time event capture with start/pause controls
- Side panel UI that doesn't interfere with normal browsing
- Time-ordered card-based event display
- Expandable event details with formatted JSON
- Search and filtering capabilities with keyword matching
- Copy functionality for event data
- CSV export for analysis
- Chinese character encoding support

## Target Users
- Frontend developers implementing analytics
- QA testers validating tracking implementation
- Product managers analyzing user behavior data

## Technical Approach
- Chrome Extension Manifest V3
- Native JavaScript implementation (no external dependencies)
- Side Panel API for non-intrusive UI
- WebRequest API for network interception