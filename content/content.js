// content/content.js - SAP Public Cloud Helper Content Script (Isolated World)

(() => {
  console.log('[SAP Public Cloud Helper] Content Script Loaded.');

  // Toast Notification
  function showToast(msg) {
    let toast = document.getElementById('sap-helper-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sap-helper-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  // Progress UI Overlay (Widget)
  let overlay = null;
  let logContainer = null;

  function createProgressOverlay() {
    overlay = document.getElementById('sap-auto-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'sap-auto-overlay';
    overlay.innerHTML = `
      <div class="auto-card">
        <div class="auto-card-header">
          <span class="auto-card-title">🤖 SAP Fiori Automation Widget</span>
          <button id="btnCloseAutoWidget" class="auto-close-btn">✕</button>
        </div>
        <div id="autoLogArea" class="auto-log-area"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    logContainer = overlay.querySelector('#autoLogArea');
    overlay.querySelector('#btnCloseAutoWidget').addEventListener('click', () => {
      overlay.remove();
    });
  }

  function log(msg, type = 'info') {
    if (!logContainer) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // Config Bridge DOM 생성 및 Main World Script 파일 주입
  function injectMainWorldAutomation(config) {
    // 1. Config Bridge DOM 생성
    let bridgeEl = document.getElementById('sap-helper-config-bridge');
    if (bridgeEl) bridgeEl.remove();

    bridgeEl = document.createElement('div');
    bridgeEl.id = 'sap-helper-config-bridge';
    bridgeEl.style.display = 'none';
    bridgeEl.dataset.config = JSON.stringify(config);
    document.body.appendChild(bridgeEl);

    // 2. Main World 스크립트 파일 주입 (CSP 우회 공식 기법)
    let script = document.getElementById('sap-helper-main-script');
    if (script) script.remove();

    script = document.createElement('script');
    script.id = 'sap-helper-main-script';
    script.src = chrome.runtime.getURL('content/mainWorld.js');
    (document.head || document.documentElement).appendChild(script);
  }

  // Main World 통신 브릿지 수신 리스너
  window.addEventListener('sap-automation-event', (event) => {
    const { action, msg, type, toast } = event.detail || {};
    if (action === 'log') {
      log(msg, type);
    } else if (action === 'toast') {
      showToast(toast);
    }
  });

  // 자동화 기동 함수
  function startAutomation(config) {
    createProgressOverlay();
    log('🤖 Fiori UI5 자동화 매크로가 시작되었습니다!');
    log(`📌 선택 모드: ${config.mode === 'CATALOG_EXT' ? '사용자 정의 카탈로그 확장' : '비즈니스 역할 유지보수'}`);

    injectMainWorldAutomation(config);
  }

  // Global Expose for Direct Dynamic Execution (e.g. from popup.js scripts)
  window.startSapFioriAutomation = (config) => {
    startAutomation(config);
  };

  // 기본 로드 시점에 Main World Script 주입 (config 없이 스크립트만 주입하여 이벤트 리스너를 미리 등록해둠)
  function injectMainWorldScriptOnly() {
    let script = document.getElementById('sap-helper-main-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'sap-helper-main-script';
      script.src = chrome.runtime.getURL('content/mainWorld.js');
      (document.head || document.documentElement).appendChild(script);
    }
  }

  // 초기화 시점 주입 실행
  injectMainWorldScriptOnly();

  // Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'RUN_FIORI_AUTOMATION') {
      startAutomation(request);
      sendResponse({ started: true });
      return true;
    }
  });
})();
