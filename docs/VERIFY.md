# T3 Stardust 1.0.1: how this release was checked

The README and the release notes stay short on purpose. The details are here for anyone who wants to check our work.

## Build identity

| Item | Value |
| --- | --- |
| Build | C89, the 1.0.1 build (C88 + C89: universal live-activity step capsule fallback for Antigravity/ACP, Spotlight full-text search fix & auto-rebuild, ArtifactWall cache & blank-window fix, 404 repo URL & Stardust update-checker fix, backend reliability fixes, and 6 upstream P0 security/stability patches). |
| Web bundle `index.html` SHA-256 | `e67c7a55b8b571c13f5248ce2ebd7e26737094f6e3618973c2ef1fe8d6b01975` |
| Installed release-candidate app archive (ASAR) SHA-256 | `5c00128b0fe355cde0a1e6ae5d4ea0229517d39d9a194a7e61bbd9357edfabd3` |
| App archive (ASAR) in the download package | `2b64417a4c5fd9d7a6f4953ee2279a3a0604bc0bdeacd32eaf116e6e1ddc1129`. It differs from the installed one in exactly one entry: the bundled copy of the resource monitor, whose build-machine file paths were overwritten with neutral bytes of the same length. Every other entry is byte-identical |
| Signature of the download package | ad-hoc (`codesign -dv` shows `Signature=adhoc`, no Team ID); not signed with an Apple Developer ID; not notarized. `codesign --verify --deep --strict` passes on the unpacked ZIP |
| Package for download | `T3-Stardust-1.0.1-macOS-arm64.zip`, SHA-256 `35d0ec21bbb3eebd14db3afb7d3613d53d1e2aa2ed4a0ee7806d69f808d47eb3` |

Every product screenshot in this repository was rendered from the Stardust web bundle (the banners and social preview add brand art and HTML text around a real render).

## Automated checks (C89 / v1.0.1)

| Check | Result |
| --- | --- |
| Type check, 7 packages (`t3`, `web`, `desktop`, `provider-acp`, `shared`, `ssh`, `client-runtime`) | 0 errors |
| Lint (`vp lint`, 19 modified files, 203 rules) | 0 errors |
| Targeted unit & Chromium browser tests (16 files) | 401 / 401 passed |
| Desktop full suite | 120 passed / 4 skipped (1,160 active tests passed) |
| Privacy scan on unpacked ZIP | 2,961 members scanned, 0 maintainer hits |
| Isolated smoke & PTY check | Welcome page rendered, 0 console/runtime errors, resource monitor healthy, `node-pty` exit 0, 0 leftover processes, real user data untouched |

## Data migration: schema 79 → 95

- C67 and earlier use database schema **79**. This release uses schema **95**.
- The release contains 95 migration files, numbered 001 to 095; the last is `095_TurnItemInlineWorkOutput`. The count and the last name were read from the source tree while preparing this page.
- Rehearsal on a read-only copy of a real database (C72): 43 original tables, 1,493,712 rows, column digests equal before and after; migrations 085 and 095, foreign keys and integrity check passed. The original database was not migrated in the rehearsal.
- C82 to C88 changed no migration file; the installed C86 and the C88 candidate list the same 95 migrations.
- The migration goes one way. The old app cannot read schema 95 safely. That is why the README asks for a cold backup of `~/.t3` first.

## Privacy

- Package and source are scanned for personal paths, user names, account names, e-mail addresses and keys before they ship. The C85 scan found 0 hits for hard-coded local paths in the source and in the production build. The final scan of the unpacked download package (2,961 files) found 0 maintainer names, accounts, build-machine paths or local signing identities; the remaining matches are third-party package authors, example addresses and upstream vendor build paths (details in `privacy-scan.json`, attached to the release). Before that scan, build-machine paths inside four native helper files and a build cache directory were removed from the package.
- Analytics are off by default (`telemetryEnabled` is false; old settings files read as off). With a clean home folder, 45 seconds after first start, a local listener received 0 analytics requests; the control run with analytics switched on received 1.
- This edition turns off auto-update when the update feed points at upstream T3 Code, and refuses npm release lookups unless `T3CODE_ALLOW_UPSTREAM_NPM_LOOKUP=1` is set.

## How the images were made

- A real T3 Stardust server (the C86 build) and a headless Chrome, both on a throwaway home folder, with outbound network blocked and the maintainer's real data folder unreadable. No real model was called.
- A small local script plays the part of the agent (a fixed six-step plan with plain tool calls), so the step capsule, the stats bar and the sidebar are the real components.
- Invented demo data: project and chat names, the four account names (Claude Home, Claude Work, Codex, Antigravity), every quota number, reset time, disk size and cleanup item. The quota, storage and category-suggestion answers are injected between the page and the server so the real components render them. The "Resets this week" timeline is the real component fed with those numbers.
- Window frame, shadow, crop and scale are added afterward. No pixel is drawn by hand. The banner and social preview use separately generated background art that contains no interface; the text on them is HTML text.
- Animations are cuts of real screen recordings of the same demo run, 7 to 10 seconds each, with a GIF, an animated WebP and an MP4 for each.

### Image check

328 images read with macOS Vision text recognition (10807 text lines, 0 read errors): 0 private matches. 9 public documents searched for personal paths, user and account names, e-mail addresses and keys: 0 matches.

### Media inventory

| File | Type | Size | SHA-256 (first 16) | What it shows | Source render |
| --- | --- | --- | --- | --- | --- |
| banner-en-dark.png | png | 1.33 MB | cd22487201db1905 | README banner: brand background art + HTML text (no UI) | - |
| banner-en-dark.webp | webp | 52 KB | f75c9cb1bf20eade | README banner: brand background art + HTML text (no UI) | - |
| banner-en-light.png | png | 1.29 MB | 938b79a77a422aaa | README banner: brand background art + HTML text (no UI) | - |
| banner-en-light.webp | webp | 47 KB | 83230a9978a76921 | README banner: brand background art + HTML text (no UI) | - |
| banner-zh-dark.png | png | 1.31 MB | 76f030a56d8c7dca | README banner: brand background art + HTML text (no UI) | - |
| banner-zh-dark.webp | webp | 43 KB | fd527662844bf2c4 | README banner: brand background art + HTML text (no UI) | - |
| banner-zh-light.png | png | 1.27 MB | 25eee0903966ba41 | README banner: brand background art + HTML text (no UI) | - |
| banner-zh-light.webp | webp | 40 KB | ad608410be3089ab | README banner: brand background art + HTML text (no UI) | - |
| categories-en-dark.webp | webp | 105 KB | 399155a94f89406e | Suggested categories dialog before anything moves | categories-en-dark.png |
| categories-en-light.webp | webp | 105 KB | f256532a0d17ded7 | Suggested categories dialog before anything moves | categories-en-light.png |
| categories-zh-dark.webp | webp | 88 KB | 617cd246e676797e | Suggested categories dialog before anything moves | categories-zh-dark.png |
| categories-zh-light.webp | webp | 89 KB | 31fcd785807cba15 | Suggested categories dialog before anything moves | categories-zh-light.png |
| cleanup-en-dark.webp | webp | 98 KB | 610520ae3f1c3c25 | Usage → Cleanup & organization, suggestions before any removal | cleanup-overview-en-dark.png |
| cleanup-en-light.webp | webp | 99 KB | c3ae39ac0a269efc | Usage → Cleanup & organization, suggestions before any removal | cleanup-overview-en-light.png |
| cleanup-zh-dark.webp | webp | 88 KB | 8d1fc411ca5c6634 | Usage → Cleanup & organization, suggestions before any removal | cleanup-overview-zh-dark.png |
| cleanup-zh-light.webp | webp | 89 KB | 95a5e958baefb1be | Usage → Cleanup & organization, suggestions before any removal | cleanup-overview-zh-light.png |
| hero-en-dark.webp | webp | 93 KB | ea9aede58ce8325e | Whole workbench, a Claude/Codex-style run in progress at 4 of 6 milestones, sidebar sorted into categories | hero-en-dark.png |
| hero-en-light.webp | webp | 94 KB | 3fbc0e8485ca5783 | Whole workbench, a Claude/Codex-style run in progress at 4 of 6 milestones, sidebar sorted into categories | hero-en-light.png |
| hero-zh-dark.webp | webp | 88 KB | 0d7b9065ff278541 | Whole workbench, a Claude/Codex-style run in progress at 4 of 6 milestones, sidebar sorted into categories | hero-zh-dark.png |
| hero-zh-light.webp | webp | 89 KB | 5ef26fa0c4a960db | Whole workbench, a Claude/Codex-style run in progress at 4 of 6 milestones, sidebar sorted into categories | hero-zh-light.png |
| quota-anim-en-dark.webp | webp | 82 KB | 3a021de8104a3639 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-en-dark, cut 0.60s-7.27s of the screencast |
| quota-anim-en-light.webp | webp | 84 KB | f1ab99d3121265f9 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-en-light, cut 0.60s-7.31s of the screencast |
| quota-anim-zh-dark.webp | webp | 82 KB | 0b3844d4cf271df2 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-zh-dark, cut 0.60s-7.30s of the screencast |
| quota-anim-zh-light.webp | webp | 79 KB | 31f3bfdc94aa6564 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-zh-light, cut 0.60s-7.29s of the screencast |
| quota-en-dark.gif | gif | 290 KB | b8b24931a8496069 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-en-dark, cut 0.60s-7.27s of the screencast |
| quota-en-dark.mp4 | mp4 | 141 KB | e36b7cb0ba85869d | Quota cards and Resets this week, lanes hovered one by one | cast-limits-en-dark, cut 0.60s-7.27s of the screencast |
| quota-en-dark.webp | webp | 105 KB | 635be7acf2605396 | Usage → Limits: four account cards and "Resets this week" with one lane hovered | limits-hover-en-dark.png |
| quota-en-light.gif | gif | 307 KB | 1c59a34dbf662aa3 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-en-light, cut 0.60s-7.31s of the screencast |
| quota-en-light.mp4 | mp4 | 136 KB | cb32a47fa1e35c8b | Quota cards and Resets this week, lanes hovered one by one | cast-limits-en-light, cut 0.60s-7.31s of the screencast |
| quota-en-light.webp | webp | 106 KB | f6e43b34f10674be | Usage → Limits: four account cards and "Resets this week" with one lane hovered | limits-hover-en-light.png |
| quota-zh-dark.gif | gif | 284 KB | a16317c31b291f6c | Quota cards and Resets this week, lanes hovered one by one | cast-limits-zh-dark, cut 0.60s-7.30s of the screencast |
| quota-zh-dark.mp4 | mp4 | 134 KB | b73eb7c5cdc58762 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-zh-dark, cut 0.60s-7.30s of the screencast |
| quota-zh-dark.webp | webp | 98 KB | 370779e54e689458 | Usage → Limits: four account cards and "Resets this week" with one lane hovered | limits-hover-zh-dark.png |
| quota-zh-light.gif | gif | 298 KB | 1236466be682a091 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-zh-light, cut 0.60s-7.29s of the screencast |
| quota-zh-light.mp4 | mp4 | 126 KB | c3b3a4c56faeaa62 | Quota cards and Resets this week, lanes hovered one by one | cast-limits-zh-light, cut 0.60s-7.29s of the screencast |
| quota-zh-light.webp | webp | 100 KB | 4ae77951845fd5dd | Usage → Limits: four account cards and "Resets this week" with one lane hovered | limits-hover-zh-light.png |
| social-preview.png | png | 496 KB | 6b04738c73ed2d68 | Social preview: brand background + HTML text + real hero render | - |
| stats-anim-en-dark.webp | webp | 765 KB | f62b10e998d8884e | Stats bar counting up, then the details popover | cast-stats-en-dark, cut 0.30s-8.94s of the screencast |
| stats-anim-en-light.webp | webp | 760 KB | 5a326ffc093cf0a4 | Stats bar counting up, then the details popover | cast-stats-en-light, cut 0.30s-8.94s of the screencast |
| stats-anim-zh-dark.webp | webp | 655 KB | 784e69cd9997d019 | Stats bar counting up, then the details popover | cast-stats-zh-dark, cut 0.30s-8.94s of the screencast |
| stats-anim-zh-light.webp | webp | 624 KB | ddf5370c572fd89f | Stats bar counting up, then the details popover | cast-stats-zh-light, cut 0.30s-8.93s of the screencast |
| stats-en-dark.gif | gif | 1.63 MB | 9da5952637922e24 | Stats bar counting up, then the details popover | cast-stats-en-dark, cut 0.30s-8.94s of the screencast |
| stats-en-dark.mp4 | mp4 | 593 KB | b5d369042b56b255 | Stats bar counting up, then the details popover | cast-stats-en-dark, cut 0.30s-8.94s of the screencast |
| stats-en-dark.webp | webp | 76 KB | d7e8f2670a5013ff | Session statistics popover after the first turn | stats-en-dark.png |
| stats-en-light.gif | gif | 1.72 MB | 5741a7ccfaa724a4 | Stats bar counting up, then the details popover | cast-stats-en-light, cut 0.30s-8.94s of the screencast |
| stats-en-light.mp4 | mp4 | 600 KB | 2f18b10013411fa5 | Stats bar counting up, then the details popover | cast-stats-en-light, cut 0.30s-8.94s of the screencast |
| stats-en-light.webp | webp | 75 KB | c39a54f90c6e7275 | Session statistics popover after the first turn | stats-en-light.png |
| stats-zh-dark.gif | gif | 1.26 MB | 7b7c8c3101933f22 | Stats bar counting up, then the details popover | cast-stats-zh-dark, cut 0.30s-8.94s of the screencast |
| stats-zh-dark.mp4 | mp4 | 504 KB | d90d93fc02bdd7d7 | Stats bar counting up, then the details popover | cast-stats-zh-dark, cut 0.30s-8.94s of the screencast |
| stats-zh-dark.webp | webp | 68 KB | 3590a2fe25413cfd | Session statistics popover after the first turn | stats-zh-dark.png |
| stats-zh-light.gif | gif | 1.26 MB | 74d01386ef1b2fba | Stats bar counting up, then the details popover | cast-stats-zh-light, cut 0.30s-8.93s of the screencast |
| stats-zh-light.mp4 | mp4 | 536 KB | ffa1f62cceadd415 | Stats bar counting up, then the details popover | cast-stats-zh-light, cut 0.30s-8.93s of the screencast |
| stats-zh-light.webp | webp | 67 KB | f5e7f56847c95f1c | Session statistics popover after the first turn | stats-zh-light.png |
| steps-anim-en-dark.webp | webp | 712 KB | fa26bcba87b2d288 | Step capsule: expand, open a stage, finish | cast-steps-en-dark, cut 1.82s-9.57s of the screencast |
| steps-anim-en-light.webp | webp | 674 KB | 458b2596e865e93c | Step capsule: expand, open a stage, finish | cast-steps-en-light, cut 1.82s-9.65s of the screencast |
| steps-anim-zh-dark.webp | webp | 581 KB | 656b5c620161ed1d | Step capsule: expand, open a stage, finish | cast-steps-zh-dark, cut 1.92s-9.68s of the screencast |
| steps-anim-zh-light.webp | webp | 613 KB | 1f2733d26b7a60e4 | Step capsule: expand, open a stage, finish | cast-steps-zh-light, cut 1.81s-9.65s of the screencast |
| steps-collapsed-en-dark.webp | webp | 45 KB | 1678901e50818f73 | Step capsule collapsed, running | steps-collapsed-en-dark.png |
| steps-collapsed-en-light.webp | webp | 44 KB | 8686fcd0f038115f | Step capsule collapsed, running | steps-collapsed-en-light.png |
| steps-collapsed-zh-dark.webp | webp | 43 KB | f0cb45822e7afd79 | Step capsule collapsed, running | steps-collapsed-zh-dark.png |
| steps-collapsed-zh-light.webp | webp | 42 KB | 44ede75ebb558bd3 | Step capsule collapsed, running | steps-collapsed-zh-light.png |
| steps-en-dark.gif | gif | 1.71 MB | 9b03230e1f8ebb5c | Step capsule: expand, open a stage, finish | cast-steps-en-dark, cut 1.82s-9.57s of the screencast |
| steps-en-dark.mp4 | mp4 | 518 KB | 8ba623d534d3ee21 | Step capsule: expand, open a stage, finish | cast-steps-en-dark, cut 1.82s-9.57s of the screencast |
| steps-en-dark.webp | webp | 95 KB | 5e62cf997aa5de3e | Step capsule expanded, one stage open to show its operations | steps-detail-en-dark.png |
| steps-en-light.gif | gif | 1.61 MB | eea909eea2095566 | Step capsule: expand, open a stage, finish | cast-steps-en-light, cut 1.82s-9.65s of the screencast |
| steps-en-light.mp4 | mp4 | 463 KB | d9f9124227f2b807 | Step capsule: expand, open a stage, finish | cast-steps-en-light, cut 1.82s-9.65s of the screencast |
| steps-en-light.webp | webp | 96 KB | 5658d1d6027af470 | Step capsule expanded, one stage open to show its operations | steps-detail-en-light.png |
| steps-zh-dark.gif | gif | 1.44 MB | 3aefcb536f43aec4 | Step capsule: expand, open a stage, finish | cast-steps-zh-dark, cut 1.92s-9.68s of the screencast |
| steps-zh-dark.mp4 | mp4 | 404 KB | 081816fc34011fc3 | Step capsule: expand, open a stage, finish | cast-steps-zh-dark, cut 1.92s-9.68s of the screencast |
| steps-zh-dark.webp | webp | 76 KB | 352d2bc0a693e751 | Step capsule expanded, one stage open to show its operations | steps-detail-zh-dark.png |
| steps-zh-light.gif | gif | 1.48 MB | 009b306c68cbe61a | Step capsule: expand, open a stage, finish | cast-steps-zh-light, cut 1.81s-9.65s of the screencast |
| steps-zh-light.mp4 | mp4 | 390 KB | 8d913ea2bb3cfaa7 | Step capsule: expand, open a stage, finish | cast-steps-zh-light, cut 1.81s-9.65s of the screencast |
| steps-zh-light.webp | webp | 76 KB | 6c61e1cd7b92b531 | Step capsule expanded, one stage open to show its operations | steps-detail-zh-light.png |
| welcome-en-dark.webp | webp | 80 KB | c91fad01be992ca3 | First-run welcome page, detected agents | welcome-en-dark.png |
| welcome-en-light.webp | webp | 80 KB | 09abfbd88d862f68 | First-run welcome page, detected agents | welcome-en-light.png |
| welcome-zh-dark.webp | webp | 75 KB | 707fabb9180f26d4 | First-run welcome page, detected agents | welcome-zh-dark.png |
| welcome-zh-light.webp | webp | 75 KB | 814f4781f640f53d | First-run welcome page, detected agents | welcome-zh-light.png |

## Not covered

- The images come from the web bundle in headless Chrome, not from a screenshot of the packaged Electron window. `backdrop-filter` in the real window was not checked.
- Real Claude and Codex end-to-end runs were not done for this release (no real model requests). Plan sources were checked with adapter tests and a recorded Codex replay.
- The download package is ad-hoc signed and not notarized, so Gatekeeper blocks the first launch (Open Anyway). Four third-party binaries of the bundled Cursor SDK keep their vendors' original signatures.

## Verify your download

```sh
shasum -a 256 T3-Stardust-1.0.1-macOS-arm64.zip
```

Compare the result with the checksum in the [release notes](https://github.com/zds-xiaoxin/xiaoxin-t3code/releases/tag/v1.0.1).
