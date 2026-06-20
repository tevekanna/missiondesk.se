# CLAUDE.md — missiondesk.se

> Read this file before answering any question or writing any code in this project.
> Last updated: 2026-05-21

---

## 1. Project Overview

**missiondesk.se** is a two-part static web project:

1. **Landing page** (`index.html` in root) — Marketing/product page for MissionDesk. Light/dark theme, responsive, no build step.
2. **Web app** (`app/`) — The full MissionDesk application deployed as a web version. **Identical JS codebase** to the Tauri desktop app (`K:\CodeProjects\MissionDesk\app\`).

The two parts are served from the same domain. The root landing page links users to the app at `/app/`.

**IP:** TerraPics.
**Repo:** `github.com/tevekanna/MissionDesk` (same repo as the desktop app; deployed via `deploy-app.yml` GitHub Actions workflow)

---

## 2. Who Lars Is — and How This Project Is Run

Lars is the product owner, not a developer. He does not write or modify code himself.

The workflow is:
1. Lars describes a feature or change in plain language (often in Swedish).
2. Claude (chat) analyses the relevant source files and writes a clear, copy-paste-ready prompt in English.
3. Lars pastes the prompt into **Claude Code**, which makes the actual file changes.
4. Lars reports results back; Claude verifies and iterates.

All prompts must be delivered in a **single fenced code block**.

---

## 3. Repository Structure

```
missiondesk.se/
├── index.html              # Landing/marketing page (root)
├── CNAME                   # GitHub Pages custom domain config
├── app/                    # Web version of MissionDesk application
│   ├── index.html          # App shell (mirrors MissionDesk/app/index.html)
│   ├── manifest.json       # PWA manifest
│   ├── css/
│   │   └── styles.css      # App styles (mirrors MissionDesk/app/css/)
│   └── js/                 # App logic — identical to MissionDesk desktop app
│       ├── app.js
│       ├── arc.js
│       ├── category.js
│       ├── containment.js
│       ├── data.js
│       ├── igrc.js
│       ├── maps.js
│       ├── oso.js
│       ├── pdf.js
│       ├── sora.js
│       └── version.js
└── .git/
```

---

## 4. Technology Stack

### Landing page (root)
| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | Vanilla CSS, CSS custom properties (light + dark theme) |
| Fonts | Barlow Semi Condensed, Space Mono, Barlow (Google Fonts) |
| Scripting | None (or minimal vanilla JS) |
| Hosting | GitHub Pages (CNAME: `missiondesk.se`) |

### Web app (`app/`)
| Layer | Technology |
|---|---|
| Framework | None — Vanilla JS (ES6+) |
| Mapping | Leaflet.js 1.9.4 (CDN) |
| PDF | pdf.js 3.11.174 (CDN) |
| Geometry | Turf.js 6.5.0 (CDN) |
| Fonts | Space Mono, Syne, Barlow Semi Condensed (Google Fonts) |

No build step. No npm dependencies for the frontend. Changes to JS/HTML/CSS are reflected directly.

---

## 5. Deployment

Deployed via the **`deploy-app.yml`** GitHub Actions workflow in the MissionDesk repo. The workflow copies `app/` content to the GitHub Pages branch.

Hosting: **GitHub Pages** with a custom domain (`missiondesk.se`) configured via the `CNAME` file.

---

## 6. Important: Shared Codebase with Desktop App

The `app/` folder here is **the same codebase** as `K:\CodeProjects\MissionDesk\app\`. Any change made to the JS/CSS in one should be reflected in the other.

**When modifying app logic:** always clarify with Lars whether the change should apply to:
- The desktop app only (`MissionDesk/app/`)
- The web version only (`missiondesk.se/app/`)
- Both (most common)

---

## 7. Landing Page Design

- **Light theme by default** (`data-theme="light"`) with dark mode toggle
- **Fonts:** Barlow Semi Condensed (headings), Space Mono (code/mono), Barlow (body)
- **Accent colours:** `#0062a8` (blue), `#b56a00` (amber), `#007a8a` (teal)
- Professional, aviation-adjacent tone — not a generic SaaS marketing page

---

## 8. Code Conventions

- British English in all comments, strings, and documentation
- ES6+ syntax throughout
- No TypeScript, no build tools, no frameworks
- CSS: custom properties in `:root`, semantic class names in kebab-case
