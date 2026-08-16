// popup.js - SAP Public Cloud Helper Logic
// DEFAULT_APP_SHORTCUTS is defined in shared/appShortcutDefaults.js, loaded
// before this script in popup.html.

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Tenant Form Elements
  const tenantNumInput = document.getElementById('tenantNum');
  const tenantAliasInput = document.getElementById('tenantAlias');
  const tenantEnvSelect = document.getElementById('tenantEnv');
  const btnAddTenant = document.getElementById('btnAddTenant');
  const tenantListContainer = document.getElementById('tenantList');
  const tenantCountBadge = document.getElementById('tenantCount');

  // Automation Form Elements
  const radioAutoModes = document.querySelectorAll('input[name="autoMode"]');
  const sectionIAM = document.getElementById('sectionIAM');
  const sectionCatalog = document.getElementById('sectionCatalog');
  const sectionRole = document.getElementById('sectionRole');
  const btnStartAutomation = document.getElementById('btnStartAutomation');

  // App Shortcuts Elements
  const selectTargetTenant = document.getElementById('selectTargetTenant');
  const appShortcutList = document.getElementById('appShortcutList');
  const btnManageShortcuts = document.getElementById('btnManageShortcuts');
  const btnDeleteCookies = document.getElementById('btnDeleteCookies');
  const btnOptions = document.getElementById('btnOptions');
  const statusMessage = document.getElementById('statusMessage');

  let activeTabObj = null;

  // 1. Navigation Tabs Switcher
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      navTabs.forEach((t) => t.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(tab.dataset.tab);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // 2. Load Active Tab Info & Auto-fill Tenant ID from Current Url
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      activeTabObj = tabs[0];
      const url = activeTabObj.url || '';

      // S/4HANA Cloud 테넌트 형식 (예: my400000) 파싱
      const match = url.match(/my(\d{6})/i);
      if (match && match[0]) {
        const parsedTenantId = match[0].toLowerCase(); // my400000
        if (tenantNumInput) {
          tenantNumInput.value = parsedTenantId;
          showStatus(`현재 탭의 테넌트 ID(${parsedTenantId})가 자동 입력되었습니다.`);
        }
      }
    }
  });

  // 3. SAP Tenants Storage Logic (Using chrome.storage.sync for persistence)
  async function getTenants() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['sap_tenants'], (result) => {
        const list = result.sap_tenants || [];
        const envOrder = { DEV: 1, CUST: 2, TEST: 3, PROD: 4 };
        list.sort((a, b) => {
          // 1차: 별칭(회사명) 알파벳순 정렬
          const compAlias = (a.alias || '').localeCompare(b.alias || '', undefined, {
            sensitivity: 'base',
            numeric: true,
          });
          if (compAlias !== 0) {
            return compAlias;
          }
          // 2차: 환경 가중치 순 정렬 (DEV > CUST > TEST > PROD)
          const orderA = envOrder[a.env] || 99;
          const orderB = envOrder[b.env] || 99;
          return orderA - orderB;
        });
        resolve(list);
      });
    });
  }

  async function saveTenants(tenants) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ sap_tenants: tenants }, () => {
        resolve();
      });
    });
  }

  async function renderTenantList() {
    const tenants = await getTenants();
    tenantCountBadge.textContent = `${tenants.length}개`;
    tenantListContainer.innerHTML = '';

    if (tenants.length === 0) {
      tenantListContainer.innerHTML = `
        <div class="empty-state">
          등록된 테넌트가 없습니다.<br>위 서식에서 6자리 숫자를 입력해 보세요!
        </div>
      `;
      return;
    }

    tenants.forEach((tenant, index) => {
      const item = document.createElement('div');
      item.className = 'tenant-item';
      const numStr = tenant.num;
      const alias = tenant.alias || `COMPANY`;
      const env = tenant.env || 'DEV';
      const homeUrl = `https://my${numStr}.s4hana.cloud.sap/ui#Shell-home`;
      const apiUrl = `https://my${numStr}-api.s4hana.cloud.sap/ui#Shell-home`;

      item.innerHTML = `
        <div class="tenant-info">
          <div class="tenant-main-line">
            <span class="env-tag ${env}">${env}</span>
            <span class="tenant-alias">${escapeHtml(alias)}</span>
            <span class="tenant-num-badge">(my${numStr})</span>
          </div>
          <div class="tenant-url-preview">my${numStr}.s4hana.cloud.sap</div>
        </div>
        <div class="tenant-item-actions">
          <button class="btn btn-primary btn-sm btn-jump" data-url="${homeUrl}" title="S/4HANA Launchpad 이동">이동</button>
          <button class="btn btn-secondary btn-sm btn-api-copy" data-url="${apiUrl}" title="-api 주소 복사"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>복사</button>
          <button class="btn btn-outline btn-sm btn-del" data-index="${index}" data-alias="${escapeHtml(alias)}" data-num="${numStr}" data-env="${env}" title="삭제"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg></button>
        </div>
      `;
      tenantListContainer.appendChild(item);
    });

    // Event Delegation for tenant list buttons
    tenantListContainer.querySelectorAll('.btn-jump').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        chrome.tabs.create({ url: e.currentTarget.dataset.url });
      });
    });

    tenantListContainer.querySelectorAll('.btn-api-copy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const apiUrl = e.currentTarget.dataset.url;
        navigator.clipboard.writeText(apiUrl).then(() => {
          showStatus('-api 주소가 클립보드에 복사되었습니다!');
        });
      });
    });

    tenantListContainer.querySelectorAll('.btn-del').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        const alias = e.currentTarget.dataset.alias || '';
        const num = e.currentTarget.dataset.num || '';
        const env = e.currentTarget.dataset.env || 'DEV';

        if (confirm(`[${env}] ${alias} (my${num}) 를 삭제하시겠습니까?`)) {
          const list = await getTenants();
          list.splice(idx, 1);
          await saveTenants(list);
          await renderTenantList();
          await renderAppShortcutsTab();
          showStatus(`테넌트 [${alias}]가 삭제되었습니다.`);
        }
      });
    });
  }

  // Add Tenant Action
  btnAddTenant.addEventListener('click', async () => {
    const rawNum = tenantNumInput.value.trim();
    const cleanNum = rawNum.replace(/[^0-9]/g, '');

    if (cleanNum.length !== 6) {
      alert('올바른 테넌트 ID/번호를 입력해 주세요 (예: my400000 또는 400000)');
      tenantNumInput.focus();
      return;
    }

    const alias = tenantAliasInput.value.trim() || 'COMPANY';
    const env = tenantEnvSelect.value;

    const list = await getTenants();
    const existingIdx = list.findIndex((t) => t.num === cleanNum);
    if (existingIdx >= 0) {
      list[existingIdx] = { num: cleanNum, alias, env };
    } else {
      list.push({ num: cleanNum, alias, env });
    }

    await saveTenants(list);
    tenantNumInput.value = '';
    tenantAliasInput.value = '';
    await renderTenantList();
    await renderAppShortcutsTab();
    showStatus(`테넌트 [${alias}] (my${cleanNum})가 등록되었습니다!`);
  });

  // Enter Key Fast Add
  tenantNumInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnAddTenant.click();
  });

  // Test Auto-Fill Action
  const btnAutoTestFill = document.getElementById('btnAutoTestFill');
  if (btnAutoTestFill) {
    btnAutoTestFill.addEventListener('click', (e) => {
      e.preventDefault();
      const autoRoleId = document.getElementById('autoRoleId');
      const autoRoleDesc = document.getElementById('autoRoleDesc');
      const autoCatalogId = document.getElementById('autoCatalogId');

      if (autoRoleId) autoRoleId.value = 'ZBR_TEST_001';
      if (autoRoleDesc) autoRoleDesc.value = '자동화 테스트';
      if (autoCatalogId) autoCatalogId.value = 'ZBC_BP_PROD';

      showStatus('테스트 데이터가 기입되었습니다.');
    });
  }

  // 4. Automation UI Toggle
  radioAutoModes.forEach((radio) => {
    radio.addEventListener('change', () => {
      const mode = document.querySelector('input[name="autoMode"]:checked').value;
      const sectionCatalogExtOnly = document.getElementById('sectionCatalogExtOnly');
      if (mode === 'CATALOG_EXT') {
        if (sectionCatalogExtOnly) sectionCatalogExtOnly.classList.remove('hidden');
        if (sectionIAM) sectionIAM.classList.add('hidden');
        if (sectionCatalog) sectionCatalog.classList.add('hidden');
        if (sectionRole) sectionRole.classList.add('hidden');
      } else {
        if (sectionCatalogExtOnly) sectionCatalogExtOnly.classList.add('hidden');
        if (sectionIAM) sectionIAM.classList.add('hidden');
        if (sectionCatalog) sectionCatalog.classList.add('hidden');
        if (sectionRole) sectionRole.classList.remove('hidden');
      }
    });
  });

  // Start Automation Action
  btnStartAutomation.addEventListener('click', () => {
    const mode = document.querySelector('input[name="autoMode"]:checked').value;
    const isCatalogExt = mode === 'CATALOG_EXT';

    const deployAppName = isCatalogExt
      ? document.getElementById('autoDeployAppName').value.trim()
      : '';

    const catalogId = isCatalogExt ? '' : document.getElementById('autoCatalogId').value.trim();

    const catalogRoles = isCatalogExt
      ? document.getElementById('autoCatalogRolesExt').value.trim()
      : '';

    const config = {
      action: 'RUN_FIORI_AUTOMATION',
      mode: mode,
      deploy_app_name: deployAppName,
      iam_id: isCatalogExt ? deployAppName : document.getElementById('autoIamId').value.trim(),
      iam_desc: isCatalogExt ? '' : document.getElementById('autoIamDesc').value.trim(),
      iam_service: isCatalogExt ? '' : document.getElementById('autoIamService').value.trim(),
      catalog_id: catalogId,
      catalog_desc: '',
      catalog_roles: catalogRoles,
      role_id: isCatalogExt ? '' : document.getElementById('autoRoleId').value.trim(),
      role_desc: isCatalogExt ? '' : document.getElementById('autoRoleDesc').value.trim(),
      role_unrestricted: isCatalogExt
        ? false
        : document.getElementById('autoRoleWriteUnrestricted').checked,
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        alert('활성화된 브라우저 탭을 찾을 수 없습니다.');
        return;
      }

      const activeTab = tabs[0];
      if (
        !activeTab.url ||
        (!activeTab.url.includes('s4hana.cloud.sap') && !activeTab.url.includes('oncnd.sap'))
      ) {
        alert(
          '현재 탭이 SAP S/4HANA Cloud 페이지가 아닙니다.\nFiori 화면으로 이동 후 다시 실행하세요.',
        );
        return;
      }

      // Send automation command to Content Script (CSP-safe messaging bridge)
      function sendCommandToTab(tabId) {
        chrome.tabs.sendMessage(tabId, config, (response) => {
          if (chrome.runtime.lastError || !response) {
            console.log('[SAP Helper] Injecting content script dynamically...');
            chrome.scripting
              .insertCSS({
                target: { tabId: tabId },
                files: ['content/content.css'],
              })
              .catch(() => {});

            chrome.scripting.executeScript(
              {
                target: { tabId: tabId },
                files: ['content/content.js'],
              },
              () => {
                // content.js가 로드되어 리스너가 등록될 때까지 잠시 대기 후 메시지 전송
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, config, (res) => {
                    if (chrome.runtime.lastError) {
                      console.error('[SAP Helper] Message retry error:', chrome.runtime.lastError);
                    } else {
                      showStatus(' Fiori 자동화가 시작되었습니다!');
                      setTimeout(() => window.close(), 400);
                    }
                  });
                }, 200);
              },
            );
          } else {
            showStatus(' Fiori 자동화가 시작되었습니다!');
            setTimeout(() => window.close(), 400);
          }
        });
      }

      sendCommandToTab(activeTab.id);
    });
  });

  // 5. App Shortcuts Tab Logic
  async function getAppShortcuts() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['sap_app_shortcuts'], (res) => {
        if (!res.sap_app_shortcuts || res.sap_app_shortcuts.length === 0) {
          resolve(DEFAULT_APP_SHORTCUTS);
        } else {
          resolve(res.sap_app_shortcuts);
        }
      });
    });
  }

  async function renderAppShortcutsTab() {
    const tenants = await getTenants();
    const appList = await getAppShortcuts();

    // Fill Tenant Select Box
    selectTargetTenant.innerHTML = `<option value="CURRENT">현재 활성화된 Fiori 탭 (주소 변경)</option>`;
    tenants.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.num;
      opt.textContent = `[${t.env || 'DEV'}] ${t.alias || 'COMPANY'} (my${t.num})`;
      selectTargetTenant.appendChild(opt);
    });

    // Render Shortcut Tiles Grid
    appShortcutList.innerHTML = '';
    appList.forEach((app) => {
      const item = document.createElement('div');
      item.className = 'shortcut-tile';
      item.innerHTML = `
        <span class="shortcut-tile-name">${escapeHtml(app.name)}</span>
        <span class="shortcut-tile-hash" title="${escapeHtml(app.hash)}">${escapeHtml(app.hash)}</span>
      `;

      item.addEventListener('click', () => {
        const targetVal = selectTargetTenant.value;
        const targetHash = app.hash.startsWith('#') ? app.hash : '#' + app.hash;

        if (targetVal === 'CURRENT') {
          if (
            activeTabObj &&
            activeTabObj.url &&
            (activeTabObj.url.includes('s4hana.cloud.sap') ||
              activeTabObj.url.includes('oncnd.sap'))
          ) {
            const baseUrl = activeTabObj.url.split('/ui#')[0];
            const finalUrl = `${baseUrl}/ui${targetHash}`;
            chrome.tabs.update(activeTabObj.id, { url: finalUrl });
            window.close();
          } else {
            alert(
              '현재 탭이 S/4HANA Cloud 페이지가 아닙니다.\n아래 드롭다운에서 등록된 테넌트를 선택하여 이동하세요.',
            );
          }
        } else {
          const finalUrl = `https://my${targetVal}.s4hana.cloud.sap/ui${targetHash}`;
          chrome.tabs.create({ url: finalUrl });
          window.close();
        }
      });

      appShortcutList.appendChild(item);
    });
  }

  if (btnManageShortcuts) {
    btnManageShortcuts.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
      }
    });
  }

  // 5-2. Fiori App Search Logic
  const appSearchQueryInput = document.getElementById('appSearchQuery');
  const btnSearchApp = document.getElementById('btnSearchApp');

  async function performAppSearch() {
    const query = appSearchQueryInput.value.trim();
    if (!query) {
      alert('검색어를 입력해 주세요.');
      appSearchQueryInput.focus();
      return;
    }

    const targetVal = selectTargetTenant.value;

    const filterObj = {
      dataSource: {
        type: 'Category',
        id: 'All',
        label: '모두',
        labelPlural: '모두',
      },
      searchTerm: query,
      rootCondition: {
        type: 'Complex',
        operator: 'And',
        conditions: [],
      },
    };
    const targetHash = `#Action-search&/top=10&filter=${encodeURIComponent(JSON.stringify(filterObj))}`;

    if (targetVal === 'CURRENT') {
      if (
        activeTabObj &&
        activeTabObj.url &&
        (activeTabObj.url.includes('s4hana.cloud.sap') || activeTabObj.url.includes('oncnd.sap'))
      ) {
        const baseUrl = activeTabObj.url.split('/ui#')[0];
        const finalUrl = `${baseUrl}/ui${targetHash}`;
        chrome.tabs.update(activeTabObj.id, { url: finalUrl });
        window.close();
      } else {
        alert(
          '현재 탭이 S/4HANA Cloud 페이지가 아닙니다.\n아래 드롭다운에서 등록된 테넌트를 선택하여 검색을 수행하세요.',
        );
      }
    } else {
      const finalUrl = `https://my${targetVal}.s4hana.cloud.sap/ui${targetHash}`;
      chrome.tabs.create({ url: finalUrl });
      window.close();
    }
  }

  if (btnSearchApp && appSearchQueryInput) {
    btnSearchApp.addEventListener('click', performAppSearch);
    appSearchQueryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performAppSearch();
      }
    });
  }

  if (btnDeleteCookies) {
    btnDeleteCookies.addEventListener('click', () => {
      if (
        confirm(
          'SAP 관련 쿠키를 삭제하시겠습니까?\n삭제 후 세션이 로그아웃되어 재로그인이 필요할 수 있습니다.',
        )
      ) {
        chrome.cookies.getAll({}, (cookies) => {
          const targetCookies = cookies.filter(
            (cookie) =>
              cookie.domain.endsWith('.s4hana.cloud.sap') ||
              cookie.domain === 's4hana.cloud.sap' ||
              cookie.domain.endsWith('.oncnd.sap') ||
              cookie.domain === 'oncnd.sap' ||
              cookie.domain.endsWith('.sap.com') ||
              cookie.domain === 'sap.com' ||
              cookie.domain.endsWith('.ondemand.com') ||
              cookie.domain === 'ondemand.com',
          );

          if (targetCookies.length === 0) {
            showStatus('삭제할 SAP 관련 쿠키가 없습니다.');
            return;
          }

          let deletedCount = 0;
          let removePromises = targetCookies.map((cookie) => {
            return new Promise((resolve) => {
              const protocol = cookie.secure ? 'https:' : 'http:';
              const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
              const url = `${protocol}//${domain}${cookie.path}`;

              chrome.cookies.remove({ url: url, name: cookie.name }, (details) => {
                if (details) deletedCount++;
                resolve();
              });
            });
          });

          Promise.all(removePromises).then(() => {
            showStatus(
              `SAP 관련 쿠키 ${deletedCount}개가 삭제되었습니다. 페이지를 새로고침 해주세요.`,
            );
          });
        });
      }
    });
  }

  if (btnOptions) {
    btnOptions.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
      }
    });
  }

  // Utility
  const DEFAULT_STATUS = 'SAP Public Cloud Helper v' + chrome.runtime.getManifest().version;
  if (statusMessage) statusMessage.textContent = DEFAULT_STATUS;

  function showStatus(msg) {
    statusMessage.textContent = msg;
    setTimeout(() => {
      statusMessage.textContent = DEFAULT_STATUS;
    }, 4000);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initial Render
  await renderTenantList();
  await renderAppShortcutsTab();
});
