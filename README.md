# SAP Public Cloud Helper (S/4HANA Cloud Assistant)

> An unofficial Chrome extension for developers and consultants working with SAP S/4HANA Cloud (Public Edition). It handles tenant management, Fiori business role and custom catalog extension publishing macros, and session cookie cleanup, all from one popup.

This project is not affiliated with or endorsed by SAP SE.

---

## Key Features

### 1. Multi-tenant management and one-click jump

- **Tenant registry**: save a 6-digit S/4HANA Cloud tenant number (e.g. `my400000`) together with an alias and environment tag (DEV, TEST, PROD).
- **One-click Launchpad jump**: open any registered tenant's Fiori Launchpad home directly.
- **`-api` endpoint copy**: copy the dedicated `-api` address (`https://my400000-api.s4hana.cloud.sap/...`) used for OData and proxy binding to the clipboard in one click.

### 2. Fiori UI5 automation macros

- **Custom Catalog Extension automation**:
  - Enter a deployed application name (e.g. `ZUMRCO0030`) and it's expanded to the IAM App ID format (`YY1_ZUMRCO0030_UI5R`), then opens the matching maintenance page directly.
  - Enter a comma-separated list of role IDs (e.g. `SAP_CORE_BC_EXT_CBO,SAP_CORE_BC_EXT_UI`) and each one is searched and selected individually via forced magnifier clicks, avoiding the dialog closing on Enter.
  - After the roles are added, it selects all rows in the main table, confirms the **Publish** action and the follow-up confirmation dialog, and refreshes the page.
- **Maintain Business Roles automation**:
  - Enter a role ID and description, and it creates the role, links it to the role catalog, sets write access to Unrestricted, and opens the business user mapping dialog automatically.

### 3. Custom Fiori app shortcuts

- **Tile grid**: frequently used standard Fiori apps (Maintain Business Roles, Custom CDS Views, ABAP Runtime Errors, View Browser, etc.) laid out as a two-column tile grid.
- **Click to jump**: click a tile directly to navigate the active tab or open a new tab, without a separate "go" button.

### 4. One-click session/cookie reset

- When switching tenants or a session gets stuck, clears cookies tied to the relevant domains (`.s4hana.cloud.sap`, `.sap.com`, `.oncnd.sap`, etc.) instead of waiting for a session timeout, so a page refresh starts a clean session immediately.

### 5. Account info at a glance

- Adds the current user's name and email to the Fiori Launchpad's top system info bar, so you always know which account you're logged into when switching between tenants.
- Adds an info icon next to it; clicking it opens SAP's own "About" dialog from the profile menu directly, without navigating there manually.

---

## Screenshots

|             Tenant registration and navigation              |          Fiori UI5 automation macro           |        Fiori app shortcut tiles         |
| :---------------------------------------------------------: | :-------------------------------------------: | :-------------------------------------: |
| ![Tenant registration and navigation](images/image%201.png) | ![Fiori UI5 automation](images/image%202.png) | ![Shortcut tiles](images/image%203.png) |

**Account info at a glance** (sample screen, real account details are redacted)

![Account info at a glance](images/image%206.png)

---

## Installation

### Load unpacked (developer mode)

1. Download the latest `sap-public-cloud-helper.zip` from [GitHub Releases](https://github.com/dongqdev/sap-public-cloud-helper/releases) and unzip it, or clone the repo:
   ```bash
   git clone https://github.com/dongqdev/sap-public-cloud-helper.git
   ```
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode** in the top right.
4. Click **Load unpacked** in the top left.
5. Select the unzipped project folder (`sap-public-cloud-helper`) to finish installing.

---

## Tech Stack

- **Platform**: Chrome Extension Manifest V3
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (dark theme, CSS Grid), JavaScript (ES6+)
- **API integration**: Chrome Storage API (`chrome.storage.sync`), Scripting API (`chrome.scripting.executeScript`), Cookies API (`chrome.cookies.remove`)
- **Automation**: DOM query selectors and XPath, an event dispatch pipeline, and local busy-state detection (BusyIndicator polling)

---

## License

This project is licensed under the MIT License.
