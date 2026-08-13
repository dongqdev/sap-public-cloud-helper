// options/options.js
// DEFAULT_APP_SHORTCUTS is defined in shared/appShortcutDefaults.js, loaded
// before this script in options.html.

document.addEventListener('DOMContentLoaded', async () => {
  const btnExportJson = document.getElementById('btnExportJson');
  const importFileInput = document.getElementById('importFileInput');
  const tenantTableBody = document.getElementById('tenantTableBody');
  const btnClearAll = document.getElementById('btnClearAll');

  // App Shortcut Elements
  const appShortcutTableBody = document.getElementById('appShortcutTableBody');
  const appNameInput = document.getElementById('appNameInput');
  const appHashInput = document.getElementById('appHashInput');
  const btnAddAppShortcut = document.getElementById('btnAddAppShortcut');
  const btnResetAppShortcuts = document.getElementById('btnResetAppShortcuts');

  // --- 1. Tenants Logic ---
  async function getTenants() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['sap_tenants'], (res) => {
        const list = res.sap_tenants || [];
        const envOrder = { 'DEV': 1, 'CUST': 2, 'TEST': 3, 'PROD': 4 };
        list.sort((a, b) => {
          // 1차: 별칭(회사명) 알파벳순 정렬
          const compAlias = (a.alias || '').localeCompare(b.alias || '', undefined, { sensitivity: 'base', numeric: true });
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
      chrome.storage.sync.set({ sap_tenants: tenants }, resolve);
    });
  }

  async function renderTenantTable() {
    const list = await getTenants();
    tenantTableBody.innerHTML = '';

    if (list.length === 0) {
      tenantTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">
            등록된 테넌트가 없습니다. 팝업창에서 6자리 번호를 등록해 보세요!
          </td>
        </tr>
      `;
      return;
    }

    list.forEach((t, index) => {
      const tr = document.createElement('tr');
      const homeUrl = `https://my${t.num}.s4hana.cloud.sap/ui#Shell-home`;
      const apiUrl = `https://my${t.num}-api.s4hana.cloud.sap/ui#Shell-home`;

      tr.innerHTML = `
        <td><span class="env-tag ${t.env || 'DEV'}">${t.env || 'DEV'}</span></td>
        <td><strong>${escapeHtml(t.alias || '')}</strong></td>
        <td><code>my${t.num}</code></td>
        <td><a href="${homeUrl}" target="_blank" class="table-link">my${t.num}.s4hana.cloud.sap</a></td>
        <td><a href="${apiUrl}" target="_blank" class="table-link table-link-secondary">my${t.num}-api.s4hana.cloud.sap</a></td>
        <td>
          <button class="btn btn-danger btn-sm btn-del" data-index="${index}">삭제</button>
        </td>
      `;
      tenantTableBody.appendChild(tr);
    });

    tenantTableBody.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        const tenants = await getTenants();
        const target = tenants[idx];
        if (!target) return;
        const env = target.env || 'DEV';
        const alias = target.alias || 'COMPANY';
        const num = target.num || '';

        if (confirm(`[${env}] ${alias} (my${num}) 를 삭제하시겠습니까?`)) {
          tenants.splice(idx, 1);
          await saveTenants(tenants);
          renderTenantTable();
        }
      });
    });
  }

  // --- 2. App Shortcuts Logic ---
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

  async function saveAppShortcuts(shortcuts) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ sap_app_shortcuts: shortcuts }, resolve);
    });
  }

  async function renderAppShortcutTable() {
    const list = await getAppShortcuts();
    appShortcutTableBody.innerHTML = '';

    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td><code>${escapeHtml(item.hash)}</code></td>
        <td>
          <button class="btn btn-danger btn-sm btn-del-app" data-index="${index}">삭제</button>
        </td>
      `;
      appShortcutTableBody.appendChild(tr);
    });

    appShortcutTableBody.querySelectorAll('.btn-del-app').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        const list = await getAppShortcuts();
        const target = list[idx];
        if (target && confirm(`[${target.name}] 바로가기를 삭제하시겠습니까?`)) {
          list.splice(idx, 1);
          await saveAppShortcuts(list);
          renderAppShortcutTable();
        }
      });
    });
  }

  btnAddAppShortcut.addEventListener('click', async () => {
    const name = appNameInput.value.trim();
    let hash = appHashInput.value.trim();

    if (!name) {
      alert('앱 이름을 입력해 주세요.');
      appNameInput.focus();
      return;
    }
    if (!hash) {
      alert('해시 주소를 입력해 주세요 (예: #BusinessUserRole-maintainNew)');
      appHashInput.focus();
      return;
    }
    if (!hash.startsWith('#')) {
      hash = '#' + hash;
    }

    const list = await getAppShortcuts();
    list.push({ name, hash });
    await saveAppShortcuts(list);

    appNameInput.value = '';
    appHashInput.value = '';
    renderAppShortcutTable();
  });

  btnResetAppShortcuts.addEventListener('click', async () => {
    if (confirm('SAP 기본 앱 바로가기 목록으로 복원하시겠습니까?')) {
      await saveAppShortcuts(DEFAULT_APP_SHORTCUTS);
      renderAppShortcutTable();
    }
  });

  // --- Export & Import ---
  btnExportJson.addEventListener('click', async () => {
    const tenants = await getTenants();
    const shortcuts = await getAppShortcuts();
    const data = { sap_tenants: tenants, sap_app_shortcuts: shortcuts };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `sap_cloud_helper_backup_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);

        let importedTenants = [];
        let importedShortcuts = [];

        if (Array.isArray(importedData)) {
          importedTenants = importedData;
        } else {
          importedTenants = importedData.sap_tenants || [];
          importedShortcuts = importedData.sap_app_shortcuts || [];
        }

        // 1. 테넌트 병합 (6자리 num 중복 방지 및 정보 업데이트)
        const currentTenants = await getTenants();
        const mergedTenants = [...currentTenants];

        importedTenants.forEach(item => {
          if (!item.num) return;
          const cleanNum = item.num.toString().replace(/[^0-9]/g, '');
          if (cleanNum.length !== 6) return;

          // 호환성 처리: 백업에 env가 'PRD'로 되어 있으면 'PROD'로 통일
          let env = item.env || 'DEV';
          if (env === 'PRD') env = 'PROD';

          const idx = mergedTenants.findIndex(t => t.num === cleanNum);
          if (idx >= 0) {
            // 중복 시 기존 정보 업데이트
            mergedTenants[idx] = {
              num: cleanNum,
              alias: item.alias || mergedTenants[idx].alias || 'COMPANY',
              env: env
            };
          } else {
            // 신규 추가
            mergedTenants.push({
              num: cleanNum,
              alias: item.alias || 'COMPANY',
              env: env
            });
          }
        });
        await saveTenants(mergedTenants);

        // 2. 앱 바로가기 병합 (hash 주소 중복 방지)
        if (importedShortcuts.length > 0) {
          const currentShortcuts = await getAppShortcuts();
          const mergedShortcuts = [...currentShortcuts];

          importedShortcuts.forEach(item => {
            if (!item.hash) return;
            let hash = item.hash.trim();
            if (!hash.startsWith('#')) {
              hash = '#' + hash;
            }

            const idx = mergedShortcuts.findIndex(s => s.hash === hash);
            if (idx >= 0) {
              // 중복 시 명칭 업데이트
              mergedShortcuts[idx] = {
                name: item.name || mergedShortcuts[idx].name || '미지정 앱',
                hash: hash
              };
            } else {
              // 신규 추가
              mergedShortcuts.push({
                name: item.name || '미지정 앱',
                hash: hash
              });
            }
          });
          await saveAppShortcuts(mergedShortcuts);
        }

        await renderTenantTable();
        await renderAppShortcutTable();
        alert('데이터 병합이 완료되었습니다. (동일 테넌트 번호 및 라우팅 해시는 기존 정보로 스마트 병합되었습니다.)');
      } catch (err) {
        console.error(err);
        alert('JSON 파싱 오류: 올바른 백업 파일인지 확인해 주세요.');
      }
    };
    reader.readAsText(file);
  });

  btnClearAll.addEventListener('click', async () => {
    if (confirm('정말로 모든 등록된 테넌트 목록을 삭제하시겠습니까?')) {
      await saveTenants([]);
      renderTenantTable();
    }
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  renderTenantTable();
  renderAppShortcutTable();
});
