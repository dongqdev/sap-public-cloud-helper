// Background Service Worker for SAP Public Cloud Helper

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SAP Public Cloud Helper] Extension installed successfully.');

  if (chrome.contextMenus) {
    // Context Menu 생성 (마우스 우클릭 메뉴)
    // onInstalled는 확장 재로드/업데이트 시에도 다시 실행되므로,
    // 이전에 등록된 메뉴가 남아있는 상태로 create()를 호출하면
    // "duplicate id" 에러가 발생한다. 항상 먼저 비우고 새로 만든다.
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'sap-fiori-home-jump',
        title: 'SAP Fiori 홈 화면으로 이동 (초기화)',
        contexts: ['page', 'selection'],
      });

      chrome.contextMenus.create({
        id: 'sap-fiori-app-search',
        title: '선택한 텍스트로 Fiori 앱 검색',
        contexts: ['selection'],
      });

      chrome.contextMenus.create({
        id: 'sap-quick-tenant-jump',
        title: '선택한 6자리 숫자로 테넌트 이동',
        contexts: ['selection'],
      });
    });
  }
});

// 컨텍스트 메뉴 클릭 핸들러
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'sap-fiori-home-jump') {
      if (
        tab &&
        tab.url &&
        (tab.url.includes('s4hana.cloud.sap') || tab.url.includes('oncnd.sap'))
      ) {
        let baseUrl = tab.url;
        if (baseUrl.includes('/ui#')) {
          baseUrl = baseUrl.split('/ui#')[0];
        } else if (baseUrl.includes('/ui')) {
          baseUrl = baseUrl.split('/ui')[0];
        }
        const finalUrl = `${baseUrl}/ui#Shell-home`;
        chrome.tabs.update(tab.id, { url: finalUrl });
      }
    } else if (info.menuItemId === 'sap-fiori-app-search') {
      const selectedText = (info.selectionText || '').trim();
      if (!selectedText) return;

      const filterObj = {
        dataSource: {
          type: 'Category',
          id: 'All',
          label: '모두',
          labelPlural: '모두',
        },
        searchTerm: selectedText,
        rootCondition: {
          type: 'Complex',
          operator: 'And',
          conditions: [],
        },
      };
      const targetHash = `#Action-search&/top=10&filter=${encodeURIComponent(JSON.stringify(filterObj))}`;

      // 현재 탭이 Fiori 페이지인지 검증
      if (
        tab &&
        tab.url &&
        (tab.url.includes('s4hana.cloud.sap') || tab.url.includes('oncnd.sap'))
      ) {
        let baseUrl = tab.url;
        if (baseUrl.includes('/ui#')) {
          baseUrl = baseUrl.split('/ui#')[0];
        } else if (baseUrl.includes('/ui')) {
          baseUrl = baseUrl.split('/ui')[0];
        }
        const finalUrl = `${baseUrl}/ui${targetHash}`;
        chrome.tabs.update(tab.id, { url: finalUrl });
      } else {
        // Fiori가 아니면 저장된 첫 번째 테넌트 정보로 새 탭 열기
        chrome.storage.sync.get(['sap_tenants'], (result) => {
          const list = result.sap_tenants || [];
          if (list.length > 0) {
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
            const defaultTenant = list[0].num;
            const finalUrl = `https://my${defaultTenant}.s4hana.cloud.sap/ui${targetHash}`;
            chrome.tabs.create({ url: finalUrl });
          } else {
            console.warn(
              '[SAP Helper] 등록된 테넌트가 없어 새 탭으로 Fiori 앱 검색을 수행할 수 없습니다.',
            );
          }
        });
      }
    } else if (info.menuItemId === 'sap-quick-tenant-jump') {
      const selectedText = (info.selectionText || '').trim();
      const tenantNum = selectedText.replace(/[^0-9]/g, '');
      if (tenantNum.length === 6) {
        const tenantUrl = `https://my${tenantNum}.s4hana.cloud.sap/ui#Shell-home`;
        chrome.tabs.create({ url: tenantUrl });
      } else {
        console.warn('[SAP Helper] 6자리 숫자가 아닙니다:', selectedText);
      }
    }
  });
}

// 메시지 수신기 (Content script <-> Popup 간 통신)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_TAB') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ status: 'ok' });
  } else if (request.action === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true; // 비동기 응답 처리
  }
});
