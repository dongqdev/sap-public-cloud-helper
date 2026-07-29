// Background Service Worker for SAP Public Cloud Helper

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SAP Public Cloud Helper] Extension installed successfully.');
  
  if (chrome.contextMenus) {
    // Context Menu 생성 (마우스 우클릭 메뉴)
    chrome.contextMenus.create({
      id: 'sap-open-api-url',
      title: 'SAP -api 엔드포인트 URL로 이동',
      contexts: ['page', 'selection']
    });

    chrome.contextMenus.create({
      id: 'sap-quick-tenant-jump',
      title: '선택한 6자리 숫자로 테넌트 이동',
      contexts: ['selection']
    });
  }
});

// 컨텍스트 메뉴 클릭 핸들러
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'sap-open-api-url') {
      if (tab && tab.url) {
        let targetUrl = tab.url;
        if (!targetUrl.includes('-api.s4hana.cloud.sap')) {
          targetUrl = targetUrl.replace('.s4hana.cloud.sap', '-api.s4hana.cloud.sap');
        }
        chrome.tabs.create({ url: targetUrl });
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
