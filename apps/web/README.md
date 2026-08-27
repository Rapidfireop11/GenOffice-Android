# RapidOffice Web Workspace

This browser workspace is an additive, **local-first** web companion to the upstream office-suite source. It does not modify the existing desktop applications.

## What runs where

| Capability                     | Execution location                 | Notes                                                                                                                                                                        |
| ------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown and text editing      | Browser                            | A private working copy is stored in Origin Private File System (OPFS) when the browser supports it.                                                                          |
| Opening and saving local files | Browser and selected file location | Chromium browsers can save directly through user-approved File System Access handles; other browsers fall back to standard import and download.                              |
| DOCX open                      | Browser                            | The upstream DOCX engine extracts document text locally. Saving a modified preview as DOCX is intentionally blocked until a lossless browser round-trip adapter is complete. |
| On-device AI                   | Browser and device GPU             | WebLLM loads a selected model into browser storage and uses WebGPU. It is optional and capability-gated.                                                                     |
| Remote AI                      | User-selected provider             | The browser sends prompts only after the user supplies and unlocks their own key. Endpoints need browser CORS support.                                                       |
| Cloud autosave                 | Not implemented                    | This initial web workspace deliberately keeps working copies local. Cloud sync should be an opt-in service with clear account and encryption controls.                       |

## Profile menu

The top-right **Profile** menu contains all requested personal controls: remote BYOK endpoint/model/key configuration, encrypted local key persistence with a user passphrase, local model selection and device validation, and precision-cursor sensitivity.

## Run locally

```bash
npm install --ignore-scripts
npm run dev:web
```

Run the focused checks with `npm run test:web` and `npm run build:web`.

## Validation status

The web workspace has been checked in a top-level Chromium page at a 375 × 812 CSS-pixel mobile viewport. The browser layout collapses into one column, preserves the touch-safe action rail, keeps the Profile settings reachable, and retains the document, AI, and local-save controls without horizontal overflow.

The web edition is an additive browser workspace, not an assertion of full feature parity with the upstream Electron applications. The existing desktop apps remain untouched. In particular, the browser edition currently supports local text/Markdown editing and local DOCX text extraction; full lossless DOCX, XLSX, PPTX, PDF, system OCR, and multi-window editing require browser-specific adapters before they can match the native suite.

## Attribution

This source tree derives from `genspark-ai/genoffice`, which is available under Apache-2.0. The upstream GenOffice and Genspark names and logos are trademarks of Mainfunc, Inc.; this new browser surface uses distinct RapidOffice branding.

The upstream CI definition is preserved at `.github/disabled-workflows/ci.yml`. It is not active in this initial import because the repository integration used to create the public fork lacks the permission GitHub requires to push active workflow files. See `.github/disabled-workflows/README.md` for activation guidance.
