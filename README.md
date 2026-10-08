# Org Planner

Two browser-based planning boards for headcount planning and project allocation. The pages remain dependency-free and can be opened directly in a browser.

## Run locally

1. Extract the Org Planner package to a folder.
2. Open `index.html` in a current browser such as Edge or Chrome.
3. On first launch, choose **Start fresh** for sample boards, or select the supplied JSON files in `SAP Run Team JSON/` and choose **Import selected JSON** to load the Run Team plans.

No installation or server is required. The app saves changes in the browser's local storage, so each person has a separate copy of the plans. To pass a plan to someone else later, use the board's **Copy JSON** action and send them that JSON file to import. Currency conversion requires an internet connection; the rest of the app works offline.

## Structure

- `HC Planning Board.html` and `Project Engagement Board.html` are the page entry points.
- `controllers/` contains page-specific startup, interaction handling, and orchestration.
- `models/state-store.js` owns localStorage serialization and persistence for board state.
- `views/dom-view.js` provides the shared DOM rendering/access adapter.
- `abap_hc.json` and `abap_projects.json` are editable/importable board data.

The controllers retain the existing board schemas, migrations, and JSON import/export behavior. Keep persistence changes in the model and page-specific interactions in their controller. As the application grows, extract board-specific calculations and render templates from the controllers into dedicated model and view modules; moving to ES modules or a bundler can follow once the boards no longer need direct-file launch support.

## Team authorization POC

The Project Engagement Board includes a browser-only authorization proof of concept. `models/team-access.js` seeds a JSON database in localStorage with users, teams, memberships, roles, and team-to-board view keys. The Run Team has a demo admin and a demo member; select either identity in the board header. The board JSON is stored under the team's view key, so users assigned to that team resolve the same board view in that browser profile.

Members can view and export the board JSON but cannot edit it through the UI. This is not secure authentication or server-side authorization: anyone with browser access can change localStorage or the JavaScript. A real deployment must move the database and shared board JSON behind an authenticated API, and enforce team membership and admin permissions on the server.