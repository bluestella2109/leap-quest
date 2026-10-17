# LEAP QUEST — stable rebuild v2

A clean, modular rebuild of the LEAP QUEST English vocabulary RPG. Static front-end works on GitHub Pages; account and leaderboard synchronization are activated by an Apps Script web app URL.

## Files
- `index.html`: application shell and screens
- `assets/css/app.css`: responsive styling and animations
- `assets/js/config.js`: optional default Apps Script URL
- `assets/js/store.js`: local progress and vocabulary state
- `assets/js/api.js`: JSONP API client (compatible with Apps Script redirects/CORS)
- `assets/js/ui.js`: navigation, feedback overlay, statistics
- `assets/js/learning.js`: game mode, timer mode, on-screen keyboard, word list
- `assets/js/app.js`: auth, settings, ranking, app initialization
- `gas/Code.gs`: Google Apps Script API

## GitHub Pages
Upload the contents of this folder to the repository root (keep the `assets` and `gas` folders). The entry file must be named `index.html`. GitHub Pages may take a few minutes to redeploy after a commit. Use a hard reload (Ctrl+F5) after deployment.

## Google Sheets / Apps Script setup
1. Create or open a Google Spreadsheet dedicated to LEAP QUEST.
2. In **Extensions → Apps Script**, paste `gas/Code.gs` into `Code.gs`.
3. Save. In Project Settings, select the correct time zone if desired.
4. Deploy → New deployment → type **Web app**. Execute as **Me** and allow access to **Anyone**. Deploy and authorize the script.
5. Copy the deployment URL ending in `/exec`.
6. In LEAP QUEST → Settings, paste that URL and save. The app runs a `ping` test.
7. The script automatically creates the `ユーザー`, `ランキング`, and `スコア履歴` tabs. `ランキング` is the source used for displayed rankings.

## Account note
Account registration issues a 6-digit numeric ID automatically; login uses that ID plus a 4-digit PIN. This build stores a SHA-256 hash of `userId:PIN`, not the PIN itself. Since 4-digit PINs have limited entropy, this should be treated as a lightweight learning app account, not high-security authentication. Do not reuse a real password.

## Included changes
- Dedicated spreadsheet `ランキング` tab is read for ranking display
- Timer offers 5 / 10 / 15 / 20 second rounds, auto-advance, pause/resume, previous/next, and three meaning display modes
- Sidebar collapses from the menu button and automatically collapses when entering study modes
- Large correct/incorrect overlay; incorrect answers show the user's answer, correct answer, and explanation, then auto-advance
- Custom on-screen QWERTY keyboard in typing mode
- Word list supports search, read-aloud, review status, mastered status, and custom word addition
- Responsive mobile layout, transition animations, progress cards, and local offline study

## Known scope boundary
The starter vocabulary is an embedded sample set rather than a complete licensed LEAP list. Add your authorized vocabulary list through the app or extend `fallbackWords` in `assets/js/learning.js`. Progress is saved locally on the current device; this version synchronizes account metadata and score totals, but not every word-level progress record across devices.
