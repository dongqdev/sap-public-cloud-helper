// content/content.js - SAP Public Cloud Helper Content Script

(() => {
  console.log('[SAP Public Cloud Helper] Content Script Loaded on:', window.location.href);

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

  // Fiori Automation Engine (DOM Manipulator)
  class FioriDomAutomationEngine {
    constructor(config) {
      this.config = config;
      this.overlay = null;
      this.logContainer = null;
    }

    async start() {
      this.createProgressOverlay();
      this.log(' Fiori 자동화 매크로가 시작되었습니다!');
      this.log(`📌 선택 모드: ${this.config.mode === 'CATALOG_EXT' ? '사용자 정의 카탈로그 확장' : '비즈니스 역할 유지보수'}`);

      try {
        if (this.config.mode === 'CATALOG_EXT') {
          await this.processCatalogExtension();
          this.log('🎉 사용자 정의 카탈로그 확장 자동화 작업이 성공적으로 수행되었습니다!', 'success');
          showToast('🎉 사용자 정의 카탈로그 확장 설정 완료! 화면 하단 [저장] 버튼을 눌러주세요.');
        } else {
          if (this.config.role_id) {
            await this.processBusinessRole();
          }
          this.log('🎉 비즈니스 역할 수동 저장을 제외한 자동화 작업이 성공적으로 수행되었습니다!', 'success');
          showToast('🎉 비즈니스 역할 설정 완료! 화면 하단 [저장] 버튼을 눌러주세요.');
        }
      } catch (err) {
        this.log(`❌ 오류 발생: ${err.message}`, 'error');
        console.error('[SAP Helper Automation Error]', err);
      }
    }

    createProgressOverlay() {
      let overlay = document.getElementById('sap-auto-overlay');
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

      this.overlay = overlay;
      this.logContainer = overlay.querySelector('#autoLogArea');

      overlay.querySelector('#btnCloseAutoWidget').addEventListener('click', () => {
        overlay.remove();
      });
    }

    log(msg, type = 'info') {
      if (!this.logContainer) return;
      const entry = document.createElement('div');
      entry.className = `log-entry log-${type}`;
      const time = new Date().toLocaleTimeString();
      entry.textContent = `[${time}] ${msg}`;
      this.logContainer.appendChild(entry);
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    async delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // SAP UI5 로딩바(.sapUiBusy, .sapUiLocalBusyIndicator) 숨김 대기
    async waitForUi5Busy(timeout = 15000) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const busyElements = document.querySelectorAll('.sapUiBusy, .sapUiLocalBusyIndicator');
        let isVisible = false;
        busyElements.forEach(el => {
          if (el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none') {
            isVisible = true;
          }
        });
        if (!isVisible) return;
        await this.delay(300);
      }
    }

    // 가시성 및 활성화 상태 정밀 검사
    isElementVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return (
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        !el.closest('.sapUiHidden')
      );
    }

    // 텍스트 기반 element 탐색 (XPath & querySelector 지원)
    async findElement(selectorsOrTexts, root = document, timeout = 10000) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        for (const item of selectorsOrTexts) {
          // CSS Selector 인 경우
          if (item.startsWith('.') || item.startsWith('#') || item.includes('[')) {
            const els = root.querySelectorAll(item);
            for (const el of els) {
              if (this.isElementVisible(el)) return el;
            }
          } else {
            // 텍스트 포함 요소 탐색 (button, bdi, span, div, a, li)
            const xpath = `.//*[self::button or self::bdi or self::span or self::a or self::div or self::li][contains(text(), '${item}')]`;
            const result = document.evaluate(xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < result.snapshotLength; i++) {
              const node = result.snapshotItem(i);
              if (this.isElementVisible(node)) return node;
            }
          }
        }
        await this.delay(300);
      }
      return null;
    }

    // SAP Fiori UI5 버튼 및 아이템 클릭 헬퍼 (Pointer, Mouse, Touch, Custom tap 이벤트 지원)
    clickElement(el) {
      if (!el) return;
      const target = el.closest('button') || el.closest('.sapMBtn') || el;

      target.focus();

      // 1. 네이티브 click() 호출
      try {
        target.click();
      } catch (e) { }

      // 2. pointerdown / pointerup / mousedown / mouseup / click 통합 디스패치
      const eventTypes = [
        { name: 'pointerdown', ctor: PointerEvent },
        { name: 'mousedown', ctor: MouseEvent },
        { name: 'pointerup', ctor: PointerEvent },
        { name: 'mouseup', ctor: MouseEvent },
        { name: 'click', ctor: MouseEvent }
      ];

      eventTypes.forEach(evtInfo => {
        try {
          const params = {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            buttons: 1
          };
          if (evtInfo.name.startsWith('pointer')) {
            params.pointerId = 1;
            params.isPrimary = true;
          }
          const evt = new evtInfo.ctor(evtInfo.name, params);
          target.dispatchEvent(evt);
          if (target !== el) {
            el.dispatchEvent(evt);
          }
        } catch (err) {
          console.error(`[SAP Helper] Click event dispatch error (${evtInfo.name}):`, err);
        }
      });

      // 3. UI5 특화 Custom 'tap' 이벤트 트리거
      try {
        const tapEvt = new CustomEvent('tap', {
          bubbles: true,
          cancelable: true
        });
        target.dispatchEvent(tapEvt);
        if (target !== el) {
          el.dispatchEvent(tapEvt);
        }
      } catch (err) { }
    }

    // 입력 필드에 값 기입 및 SAP UI5 바인딩 이벤트(input/change) 트리거
    async fillInput(inputElement, value) {
      if (!inputElement) return;
      inputElement.focus();
      inputElement.value = value;

      // UI5 양방향 데이터 바인딩 갱신용 이벤트 시퀀스 디스패치
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));

      const keyEvents = ['keydown', 'keypress', 'keyup'];
      keyEvents.forEach(evtName => {
        inputElement.dispatchEvent(new KeyboardEvent(evtName, { bubbles: true }));
      });

      inputElement.blur();
      await this.delay(300);
    }

    // SAP UI5 IconTabFilter 탭 전환 및 활성화 상태(aria-selected) 검증 헬퍼
    async switchTab(tabElement, tabName = "탭", timeout = 10000) {
      if (!tabElement) {
        this.log(`[경고] '${tabName}' 탭 요소를 찾지 못해 전환할 수 없습니다.`, 'error');
        return false;
      }

      this.log(`[Tab] '${tabName}' 탭으로 이동을 시작합니다...`);

      const startTime = Date.now();
      let isActivated = false;

      while (Date.now() - startTime < timeout) {
        // 현재 선택 상태 검사 (aria-selected="true" 또는 sapMITBSelected 클래스 포함)
        const isSelected = tabElement.getAttribute('aria-selected') === 'true' || 
                           tabElement.classList.contains('sapMITBSelected');
        
        if (isSelected) {
          isActivated = true;
          break;
        }

        // 클릭 시도
        this.clickElement(tabElement);
        await this.waitForUi5Busy();
        await this.delay(500);

        // 다시 상태 검사
        const isSelectedRetry = tabElement.getAttribute('aria-selected') === 'true' || 
                                tabElement.classList.contains('sapMITBSelected');
        if (isSelectedRetry) {
          isActivated = true;
          break;
        }

        await this.delay(300);
      }

      if (isActivated) {
        this.log(`[Tab] '${tabName}' 탭 전환 성공! (활성화 완료)`, 'success');
        await this.delay(800); // 탭 컨텐츠 렌더링 안정화 버퍼
        return true;
      } else {
        this.log(`[Tab] [경고] '${tabName}' 탭이 활성화(selected)되지 않았습니다.`, 'error');
        return false;
      }
    }

    // --- 사용자 정의 카탈로그 확장 (Custom Catalog Extension) 매크로 ---
    async processCatalogExtension() {
      const rawId = this.config.iam_id || '';
      if (!rawId) {
        throw new Error("app.name(IAM App ID) 입력값이 없습니다.");
      }

      // 입력한 이름을 IAM App ID 규격(YY1_<이름>_UI5R)으로 변환
      let iamId = rawId.trim().toUpperCase();
      if (!iamId.startsWith('YY1_')) {
        iamId = 'YY1_' + iamId;
      }
      if (!iamId.endsWith('_UI5R')) {
        iamId = iamId + '_UI5R';
      }

      this.log(`[CatalogExt] 사용자 정의 카탈로그 확장 처리 시작: ID=${iamId}`);

      // 1. 사용자 정의 카탈로그 확장 화면 이동
      const targetHash = `#CustomCatalogExtension-maintain&/aps_iam_app_bcat_ddl/${iamId}`;
      if (!window.location.hash.includes(`CustomCatalogExtension-maintain&/aps_iam_app_bcat_ddl/${iamId}`)) {
        this.log(`[CatalogExt] '사용자 정의 카탈로그 확장' (${targetHash}) 화면으로 이동합니다...`);
        window.location.hash = targetHash;
        await this.delay(3500);
      }
      await this.waitForUi5Busy();

      // 2. 이동 성공 및 오류 검증 (최대 10초 대기)
      this.log(`[CatalogExt] 화면 로드 대기 중...`);
      const checkStartTime = Date.now();
      let loadSuccess = false;
      while (Date.now() - checkStartTime < 10000) {
        const titleEl = document.getElementById('application-CustomCatalogExtension-maintain-component---details--businesscatalogtitle');
        if (titleEl && this.isElementVisible(titleEl)) {
          loadSuccess = true;
          break;
        }
        const errorEl = document.getElementById('application-CustomCatalogExtension-maintain-component---objectNotFound--page-text');
        if (errorEl && this.isElementVisible(errorEl)) {
          const errMsg = errorEl.textContent.trim();
          throw new Error(`이동 실패: ${errMsg}`);
        }
        await this.delay(500);
      }

      if (!loadSuccess) {
        throw new Error("화면 로드 타임아웃 또는 실패");
      }
      this.log(`[CatalogExt] 카탈로그 확장 상세 화면 진입 완료.`, 'success');

      // 3. '추가' 버튼 클릭
      const addBtn = await this.findElement(['#application-CustomCatalogExtension-maintain-component---details--buttonAddCatalogRole']);
      if (!addBtn) {
        throw new Error("'추가' 버튼을 찾을 수 없습니다.");
      }
      this.log(`[CatalogExt] '추가' 버튼 클릭...`);
      this.clickElement(addBtn);
      await this.waitForUi5Busy();
      await this.delay(1500); // 다이얼로그 로딩 대기

      // 4. 역할 선택 다이얼로그에서 각 역할 개별 검색 및 선택 진행
      const rolesInput = this.config.catalog_roles || '';
      const targetRoles = rolesInput
        ? rolesInput.split(',').map(r => r.trim()).filter(Boolean)
        : ['SAP_CORE_BC_EXT_CBO', 'SAP_CORE_BC_EXT_UI'];

      for (const roleId of targetRoles) {
        this.log(`[CatalogExt] 역할 검색창에 입력: ${roleId}`);
        const searchField = await this.findElement([
          '#selectCatalogRolesDialog-searchField-I',
          'input[id*="selectCatalogRolesDialog-searchField"]'
        ]);

        if (searchField) {
          await this.fillInput(searchField, roleId);

          // 엔터 키는 다이얼로그 닫힘(Confirm 오동작)을 유발하므로 돋보기 버튼 클릭으로만 검색 확정
          const searchBtn = await this.findElement([
            '#selectCatalogRolesDialog-searchField-search',
            '[id*="selectCatalogRolesDialog-searchField-search"]'
          ]);
          if (searchBtn) {
            this.clickElement(searchBtn);
          }
          await this.waitForUi5Busy();
          await this.delay(1800); // 결과 로드 대기
        }

        // 결과 테이블에서 해당 역할 찾기 및 체크박스 클릭
        const trs = document.querySelectorAll("tr.sapMListTblRow, tr[id*='selectCatalogRolesDialog-table']");
        let checked = false;
        for (const tr of trs) {
          const texts = tr.querySelectorAll('.sapMText, .sapMObjectIdentifierTitle, bdi, span');
          let isExactMatch = false;
          for (const txt of texts) {
            if (txt.textContent.trim() === roleId) {
              isExactMatch = true;
              break;
            }
          }

          if (isExactMatch) {
            const cb = tr.querySelector('.sapMCb, input[type="checkbox"]');
            if (cb) {
              const isChecked = cb.getAttribute('aria-checked') === 'true' || cb.classList.contains('sapMCbMark');
              const inputCb = cb.querySelector('input[type="checkbox"]') || cb;
              const isInputChecked = inputCb && inputCb.checked;

              if (!isChecked && !isInputChecked) {
                this.log(`[CatalogExt] 역할 '${roleId}' 행의 체크박스를 클릭합니다.`);
                this.clickElement(cb);
                await this.delay(800);
              } else {
                this.log(`[CatalogExt] 역할 '${roleId}'는 이미 선택되어 있습니다.`);
              }
              checked = true;
              break;
            }
          }
        }
        if (!checked) {
          this.log(`[CatalogExt] [경고] 검색 결과에서 역할 '${roleId}'를 찾지 못했습니다.`, 'error');
        }
      }

      // 최종 "확인" 버튼 클릭하여 다이얼로그 추가 반영
      const okBtn = await this.findElement([
        '#selectCatalogRolesDialog-ok',
        'button[id*="selectCatalogRolesDialog-ok"]'
      ]);
      if (okBtn) {
        let isDisabled = true;
        for (let attempt = 0; attempt < 10; attempt++) {
          isDisabled = okBtn.hasAttribute('disabled') ||
                       okBtn.getAttribute('disabled') === 'disabled' ||
                       okBtn.classList.contains('sapMBtnDisabled');
          if (!isDisabled) break;
          await this.delay(300);
        }

        this.log("[CatalogExt] 다이얼로그 '확인' 버튼을 클릭하여 추가합니다.");
        this.clickElement(okBtn);
        await this.waitForUi5Busy();
        await this.delay(2000); // 다이얼로그 완전히 닫히고 화면 바인딩 갱신 대기
      } else {
        throw new Error("다이얼로그 '확인' 버튼을 찾을 수 없습니다.");
      }

      // 5. 최종 '게시 (Publish)' 자동화 진행
      // 게시 버튼 활성화를 위해 메인 테이블 헤더의 '모두 선택' 체크박스를 클릭
      const selectAllCb = await this.findElement([
        '#application-CustomCatalogExtension-maintain-component---details--businesscatalogTable-sa',
        '[id*="businesscatalogTable-sa"]'
      ], document, 5000);

      if (selectAllCb) {
        this.log("[CatalogExt] 테이블 헤더의 '모두 선택' 체크박스를 클릭하여 역할을 전체 선택합니다.");
        this.clickElement(selectAllCb);
        await this.delay(1000); // 활성화 바인딩 대기
      } else {
        this.log("[경고] '모두 선택' 체크박스를 찾지 못해 게시 버튼 활성화를 시도할 수 없습니다.", 'error');
      }

      this.log("[CatalogExt] 최종 변경 사항 적용을 위해 '게시' 버튼을 탐색합니다...");
      const publishBtn = await this.findElement([
        '#application-CustomCatalogExtension-maintain-component---details--buttonActiveCatalogRol',
        '[id*="buttonActiveCatalogRol"]',
        '[id*="publishButton"]',
        '[id*="btnPublish"]',
        'button[id*="Publish"]',
        'button[id*="publish"]',
        '게시', 'Publish'
      ], document, 8000);

      if (publishBtn) {
        // disabled 상태가 해제될 때까지 최대 3초 대기
        let isDisabled = true;
        for (let attempt = 0; attempt < 10; attempt++) {
          isDisabled = publishBtn.hasAttribute('disabled') ||
                       publishBtn.getAttribute('disabled') === 'disabled' ||
                       publishBtn.classList.contains('sapMBtnDisabled');
          if (!isDisabled) break;
          await this.delay(300);
        }

        if (isDisabled) {
          this.log("[오류] 체크박스 선택 후에도 '게시' 버튼이 활성화되지 않았습니다. 매크로를 중단합니다.", 'error');
          return;
        }

        this.log("[CatalogExt] '게시' 버튼을 클릭합니다.");
        this.clickElement(publishBtn);
        await this.waitForUi5Busy();
        await this.delay(2000);

        // 게시 확인 팝업 다이얼로그 처리 (존재 시)
        // 동적으로 증가하는 MessageBox 버튼 ID(__mbox-btn-*)를 대응하기 위한 정밀 폴링 탐색
        let confirmPublishBtn = null;
        const searchMboxStartTime = Date.now();
        while (Date.now() - searchMboxStartTime < 4000) {
          const mboxBtns = document.querySelectorAll('button[id^="__mbox-btn-"]');
          for (const btn of mboxBtns) {
            if (this.isElementVisible(btn)) {
              const btnText = btn.textContent.trim();
              if (btnText.includes('확인') || btnText.toUpperCase().includes('OK') || btnText.toUpperCase().includes('YES')) {
                confirmPublishBtn = btn;
                break;
              }
            }
          }
          if (confirmPublishBtn) break;
          await this.delay(300);
        }

        // 정밀 탐색 실패 시 기존 findElement Fallback 적용
        if (!confirmPublishBtn) {
          confirmPublishBtn = await this.findElement([
            '#publishDialog-ok',
            'button[id*="publishDialog"]',
            'button[id*="Confirm"]',
            '게시', 'Publish', 'OK', '확인'
          ], document, 1000);
        }

        if (confirmPublishBtn && confirmPublishBtn !== publishBtn) {
          this.log("[CatalogExt] 게시 확인 다이얼로그의 '게시/확인' 버튼을 클릭합니다.");
          this.clickElement(confirmPublishBtn);
          await this.waitForUi5Busy();
          await this.delay(2500);
        }

        // 최종 반영 후 화면 갱신 새로고침 클릭
        this.log("[CatalogExt] 최종 반영 완료 후 상태 갱신을 위해 '새로 고침' 버튼을 탐색합니다...");
        const refreshBtn = await this.findElement([
          '#application-CustomCatalogExtension-maintain-component---details--buttonDetailsRefresh',
          '[id*="buttonDetailsRefresh"]',
          '새로 고침'
        ], document, 5000);

        if (refreshBtn) {
          this.log("[CatalogExt] '새로 고침' 버튼을 클릭합니다.");
          this.clickElement(refreshBtn);
          await this.waitForUi5Busy();
          await this.delay(1500);
        }

        this.log("[CatalogExt] 최종 게시 처리가 성공적으로 완료되었습니다.", 'success');
      } else {
        this.log("[경고] '게시' 버튼을 찾지 못했습니다. 상세 화면에서 직접 '게시' 버튼을 클릭해 주세요.", 'error');
      }
    }

    // --- 비즈니스 역할 유지보수 (Maintain Business Roles) 매크로 ---
    async processBusinessRole() {
      const roleId = this.config.role_id;
      const roleTitle = this.config.role_desc || roleId;
      const catalogId = this.config.catalog_id;

      this.log(`[Role] 비즈니스 역할 처리 시작: ID=${roleId}`);

      // 1. Maintain Business Roles 화면 이동 확인
      const targetHash = '#BusinessUserRole-maintainNew';
      if (!window.location.hash.includes('BusinessUserRole-maintainNew')) {
        this.log(`[Role] 'Maintain Business Roles' (${targetHash}) 화면으로 이동합니다...`);
        window.location.hash = targetHash;
        await this.delay(3500);
      }
      await this.waitForUi5Busy();

      // 2. '신규' / 'New' / 'Create' 버튼 클릭 및 다이얼로그 감지 루프 (최대 5회)
      this.log("[Role] 신규 역할 생성을 위해 '신규' 버튼을 탐색합니다...");
      const createBtn = await this.findElement([
        '[id="application-BusinessUserRole-maintainNew-component---worklist--btnFooterMainAction"]',
        '[id*="btnFooterMainAction"]',
        '[id*="btnFooterMainAction-BDI-content"]',
        '#application-BusinessUserRole-maintainNew-component---worklist--btnFooterMainAction-BDI-content',
        'New', '신규', 'Create',
        "button[id*='create']", "button[id*='new']"
      ]);

      let roleIdInput = null;
      let roleDescInput = null;

      if (createBtn) {
        this.log("[Role] '신규' 버튼을 발견했습니다. 다이얼로그가 뜰 때까지 클릭을 시도합니다.");
        for (let attempt = 1; attempt <= 5; attempt++) {
          this.log(`[Role] '신규' 버튼 클릭 시도 (${attempt}/5)...`);
          this.clickElement(createBtn);
          await this.waitForUi5Busy();
          await this.delay(1200);

          // 다이얼로그 필드가 생성되었는지 검출
          roleIdInput = await this.findElement([
            'input[id="RoleIdInput-inner"]',
            'input[id*="RoleIdInput"]',
            '#RoleIdInput-inner'
          ], document, 1500);

          roleDescInput = await this.findElement([
            'input[id="RoleDescInput-inner"]',
            'input[id*="RoleDescInput"]',
            '#RoleDescInput-inner'
          ], document, 500);

          if (roleIdInput && roleDescInput) {
            this.log("[Role] 역할 입력 다이얼로그가 정상적으로 로드되었습니다.");
            break;
          }
        }
      } else {
        this.log("[경고] '신규' 버튼을 발견하지 못했습니다. 기존 화면 진행을 시도합니다.", 'error');
        // 기존 다이얼로그가 이미 열려있을 수도 있으므로 탐색 시도
        roleIdInput = await this.findElement([
          'input[id="RoleIdInput-inner"]',
          'input[id*="RoleIdInput"]',
          '#RoleIdInput-inner'
        ]);
        roleDescInput = await this.findElement([
          'input[id="RoleDescInput-inner"]',
          'input[id*="RoleDescInput"]',
          '#RoleDescInput-inner'
        ]);
      }

      // 3. 다이얼로그에 역할 ID 및 내역 기입
      if (roleIdInput && roleDescInput) {
        this.log(`[Role] 비즈니스 역할 ID 기입 중: ${roleId}`);
        await this.fillInput(roleIdInput, roleId);

        this.log(`[Role] 비즈니스 역할 내역 기입 중: ${roleTitle}`);
        await this.fillInput(roleDescInput, roleTitle);

        await this.delay(500);

        // 다이얼로그의 'Create' / '생성' 버튼 클릭 (ID: newBusinessRoleDialogCreateBtn)
        const dialogCreateBtn = await this.findElement([
          '#newBusinessRoleDialogCreateBtn',
          'button[id*="newBusinessRoleDialogCreateBtn"]',
          'Create', '생성'
        ]);

        if (dialogCreateBtn) {
          // 생성 버튼 활성화 여부를 최대 3회(각 300ms) 재검사하여 UI5 바인딩 완료를 유연하게 대기
          let isCreateDisabled = true;
          for (let attempt = 0; attempt < 3; attempt++) {
            isCreateDisabled = dialogCreateBtn.hasAttribute('disabled') ||
              dialogCreateBtn.getAttribute('disabled') === 'disabled' ||
              dialogCreateBtn.classList.contains('sapMBtnDisabled');
            if (!isCreateDisabled) break;
            await this.delay(300);
          }

          if (isCreateDisabled) {
            this.log("[오류] 입력 필드 기입 후에도 생성 버튼이 활성화되지 않았습니다. (동일한 ID의 역할이 이미 존재하거나 드래프트 상태일 수 있으니, 중복 및 드래프트 여부를 확인해주세요.) 매크로를 중단합니다.", 'error');
            // 다이얼로그 취소(Cancel) 버튼 클릭하여 정리
            const cancelBtn = await this.findElement([
              '#newBusinessRoleDialogCancelBtn',
              'button[id*="newBusinessRoleDialogCancelBtn"]',
              'Cancel', '취소'
            ]);
            if (cancelBtn) {
              this.log("[Role] 생성 다이얼로그 취소 버튼을 클릭합니다.");
              this.clickElement(cancelBtn);
              await this.waitForUi5Busy();
              await this.delay(1000); // 다이얼로그가 완전히 닫히도록 대기

              // 메인 화면 검색창에 역할 ID 입력 및 검색 실행
              this.log(`[Role] 메인 화면 필터바에서 역할 ID(${roleId}) 검색을 시도합니다...`);
              const filterSearchInput = await this.findElement([
                'input[id="application-BusinessUserRole-maintainNew-component---worklist--FilterBar-btnBasicSearch-I"]',
                'input[id*="FilterBar-btnBasicSearch-I"]',
                'input[placeholder="검색"]'
              ], document, 5000);

              if (filterSearchInput) {
                await this.fillInput(filterSearchInput, roleId);

                // 실행(Go) 버튼 클릭
                const goBtn = await this.findElement([
                  '#application-BusinessUserRole-maintainNew-component---worklist--FilterBar-btnGo',
                  'button[id*="FilterBar-btnGo"]',
                  '실행', 'Go'
                ], document, 3000);

                if (goBtn) {
                  this.log("[Role] 검색 실행 버튼을 클릭합니다.");
                  this.clickElement(goBtn);
                  await this.waitForUi5Busy();
                } else {
                  this.log("[경고] 검색 실행(Go) 버튼을 찾지 못했습니다.", 'error');
                }
              } else {
                this.log("[경고] 메인 검색 필드(FilterBar)를 찾지 못했습니다.", 'error');
              }
            }
            return;
          }

          this.log("[Role] 다이얼로그 '생성' 버튼 클릭...");
          this.clickElement(dialogCreateBtn);
          await this.waitForUi5Busy();

          // 1. 다이얼로그가 완전히 닫힐 때까지 감지 대기 (최대 10초)
          this.log("[Role] 생성 다이얼로그가 닫힐 때까지 대기 중...");
          const dlgStartTime = Date.now();
          while (Date.now() - dlgStartTime < 10000) {
            const dlg = document.getElementById('newBusinessRoleDialog');
            if (!dlg || dlg.offsetWidth === 0 || dlg.offsetHeight === 0) {
              break;
            }
            await this.delay(300);
          }
          await this.waitForUi5Busy();

          // 2. 상세 화면 전환 완료 감지 (최대 10초)
          this.log("[Role] 상세 보기 화면(Object Page) 전환 감지 중 (비즈니스 카탈로그 탭 감지 대기)...");
          const urlStartTime = Date.now();
          while (Date.now() - urlStartTime < 10000) {
            const hasCatalogTab = document.getElementById('application-BusinessUserRole-maintainNew-component---object--iconTabFilter.BusinessCatalog') !== null;
            if (hasCatalogTab) {
              this.log("[Role] 비즈니스 카탈로그 탭이 감지되어 상세 화면으로 전환되었습니다.");
              break;
            }
            await this.delay(400);
          }

          await this.waitForUi5Busy();
          await this.delay(800); // 렌더링 안정화를 위해 0.8초 대기
          this.log("[Role] 상세 화면 로드가 완료되었습니다.");
        } else {
          this.log("[경고] 다이얼로그 '생성' 버튼을 발견하지 못했습니다.", 'error');
        }
      } else {
        this.log("[경고] 다이얼로그 입력 필드를 찾지 못했습니다.", 'error');
      }

      // 4. Business Catalog 탭으로 이동 및 카탈로그 추가 (catalog_id가 전달된 경우)
      if (catalogId) {
        this.log(`[Role] 비즈니스 카탈로그(${catalogId}) 추가 진행...`);

        // 카탈로그 탭 클릭
        const catalogTab = await this.findElement([
          '[id="application-BusinessUserRole-maintainNew-component---object--iconTabFilter.BusinessCatalog"]',
          'Business Catalogs', '비즈니스 카탈로그'
        ]);

        if (catalogTab) {
          await this.switchTab(catalogTab, '비즈니스 카탈로그');
        }

        // 카탈로그 추가 버튼 클릭
        const addBtn = await this.findElement([
          '[id="application-BusinessUserRole-maintainNew-component---object--button.BusinessCatalogAssignmentTableAdd"]',
          'Add', '추가'
        ]);

        if (addBtn) {
          this.log("[Role] 카탈로그 추가 버튼을 클릭합니다.");
          this.clickElement(addBtn);
          await this.waitForUi5Busy();

          // 검색창에 catalog_id 검색
          const searchInput = await this.findElement([
            'input[id="searchField.AddBusinessCatalogAssignmentTable-I"]',
            'input[id*="AddBusinessCatalogAssignmentTable"]',
            '#searchField.AddBusinessCatalogAssignmentTable-I'
          ]);

          if (searchInput) {
            this.log(`[Role] 카탈로그 검색창에 (${catalogId}) 검색 입력...`);
            await this.fillInput(searchInput, catalogId);

            // 엔터 키 이벤트 시퀀스 발송
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));

            // 돋보기 검색 아이콘 클릭 트리거 (검색 확정 유도)
            const searchIcon = await this.findElement([
              '#searchField.AddBusinessCatalogAssignmentTable-search',
              '[id*="AddBusinessCatalogAssignmentTable-search"]'
            ]);
            if (searchIcon) {
              this.clickElement(searchIcon);
            }

            await this.waitForUi5Busy();
            await this.delay(1800); // 검색 목록 바인딩 시간 보정

            // 검색 결과 테이블에서 해당 catalog_id 행의 체크박스 선택 (ID 컬럼과 정확히 100% 일치하는지 비교)
            const trs = document.querySelectorAll("tr[id*='columnListItem.AddBusinessCatalogAssignmentTable'], tr.sapMListTblRow");
            let targetCheck = null;

            for (const tr of trs) {
              // 행 안의 텍스트 요소들 중 catalogId와 100% 일치하는 ID 컬럼 검출
              const texts = tr.querySelectorAll('.sapMText, .sapMObjectIdentifierTitle, bdi');
              let isExactMatch = false;
              for (const txt of texts) {
                if (txt.textContent.trim() === catalogId) {
                  isExactMatch = true;
                  break;
                }
              }

              if (isExactMatch) {
                targetCheck = tr.querySelector('.sapMCb, input[type="checkbox"]');
                if (targetCheck) break;
              }
            }

            // 정확히 100% 매치되는 것을 못 찾은 경우 Fallback으로 텍스트 포함 확인
            if (!targetCheck) {
              for (const tr of trs) {
                if (tr.innerText.includes(catalogId)) {
                  targetCheck = tr.querySelector('.sapMCb, input[type="checkbox"]');
                  if (targetCheck) break;
                }
              }
            }

            if (targetCheck) {
              this.log("[Role] 일치하는 비즈니스 카탈로그 행의 체크박스를 클릭합니다.");
              this.clickElement(targetCheck);
              await this.delay(800); // 체크 상태 변경 바인딩 대기
            } else {
              this.log("[경고] 일치하는 비즈니스 카탈로그를 테이블에서 찾지 못했습니다.", 'error');
            }

            // 적용(OK) 버튼 클릭
            const applyBtn = await this.findElement([
              'button[id="button.AddBusinessCatalogAssignmentDialogOK"]',
              '#button.AddBusinessCatalogAssignmentDialogOK',
              'OK', '확인', '적용'
            ]);

            if (applyBtn) {
              // 체크박스 클릭 후 '확인' 버튼의 disabled 속성이 풀릴 때까지 유연하게 최대 3초(300ms * 10회) 대기 감지
              let isDisabled = true;
              for (let attempt = 0; attempt < 10; attempt++) {
                isDisabled = applyBtn.hasAttribute('disabled') ||
                  applyBtn.getAttribute('disabled') === 'disabled' ||
                  applyBtn.classList.contains('sapMBtnDisabled');
                if (!isDisabled) break;
                await this.delay(300);
              }

              if (isDisabled) {
                this.log("[오류] 일치하는 비즈니스 카탈로그가 없거나 확인 버튼이 비활성화 상태입니다. 매크로를 중단합니다.", 'error');

                // 팝업 취소(Cancel) 버튼 클릭하여 닫기
                const cancelBtn = await this.findElement([
                  'button[id="button.AddBusinessCatalogAssignmentDialogCancel"]',
                  'Cancel', '취소'
                ]);
                if (cancelBtn) {
                  this.clickElement(cancelBtn);
                  await this.waitForUi5Busy();
                }
                return;
              }

              this.log("[Role] 카탈로그 추가 확인(OK) 버튼을 클릭합니다.");
              this.clickElement(applyBtn);
              await this.waitForUi5Busy();

              // 카탈로그 추가 다이얼로그가 화면에서 완전히 닫힐 때까지 대기
              this.log("[Role] 카탈로그 추가 다이얼로그가 닫히기를 기다립니다...");
              const dlgStartTime = Date.now();
              while (Date.now() - dlgStartTime < 10000) {
                const dlg = document.querySelector('[id*="AddBusinessCatalogAssignmentDialog"]');
                if (!dlg || dlg.offsetWidth === 0 || dlg.offsetHeight === 0) {
                  break;
                }
                await this.delay(300);
              }
              await this.waitForUi5Busy();
              await this.delay(1000); // 팝업 닫힘 및 테이블 갱신 반영 대기
            }
          }
        }
      }

      // 5. '일반 역할 세부사항' 탭으로 이동하여 액세스 범주 권한 설정
      if (this.config.role_unrestricted) {
        const generalTab = await this.findElement([
          '[id="application-BusinessUserRole-maintainNew-component---object--icontabfilter.brov"]',
          'General Role Details', '일반 역할 세부사항'
        ]);

        if (generalTab) {
          await this.switchTab(generalTab, '일반 역할 세부사항');
        }

        // 쓰기 액세스 권한 셀렉트박스를 무제한(Unrestricted)으로 구성
        this.log("[Role] 쓰기 액세스 권한을 '무제한(Unrestricted)'으로 설정 시도...");
        const writeAccessSelect = await this.findElement([
          '[id*="select.WriteAccess"]'
        ], document, 5000);

        if (writeAccessSelect) {
          try {
            this.log("[Role] 쓰기 액세스 권한 콤보박스를 클릭합니다.");
            this.clickElement(writeAccessSelect);
            await this.delay(800); // 콤보박스 옵션 팝업 대기

            // 드롭다운 목록에서 '무제한' 옵션을 직접 탐색
            this.log("[Role] 드롭다운 목록에서 '무제한' 옵션을 탐색합니다.");
            let unrestrictedOption = null;
            
            // 최대 3초간 폴링하며 옵션 팝업의 요소를 탐색
            const optStartTime = Date.now();
            while (Date.now() - optStartTime < 3000) {
              // 1. ID 기반 매칭 우선 탐색 (WriteAccess-0 포함 li)
              unrestrictedOption = document.querySelector('li[id*="select.WriteAccess-0"]') || 
                                   document.querySelector('[id*="select.WriteAccess-0"]');

              // 2. Fallback: 텍스트 기반 매칭 탐색
              if (!unrestrictedOption) {
                const options = document.querySelectorAll('.sapMSelectList li, [role="option"], .sapMSelectListItemText');
                for (const opt of options) {
                  const text = opt.textContent.trim();
                  if (text === '무제한' || text === 'Unrestricted') {
                    unrestrictedOption = opt;
                    break;
                  }
                }
              }

              // 발견 즉시 루프 탈출 (가시성 체크의 일시적 실패 우회)
              if (unrestrictedOption) {
                break;
              }
              await this.delay(200);
            }

            if (unrestrictedOption) {
              this.log("[Role] 쓰기 액세스를 '무제한'으로 선택합니다.");
              this.clickElement(unrestrictedOption);
              await this.waitForUi5Busy();
              await this.delay(800); // UI5 바인딩 업데이트 대기

              // 변경 사항이 실제 DOM에 최종 반영되었는지 검증 (최대 3초)
              let isUpdated = false;
              for (let attempt = 0; attempt < 10; attempt++) {
                const labelEl = document.querySelector("#application-BusinessUserRole-maintainNew-component---object--select\\.WriteAccess-label") || 
                                document.querySelector('[id*="select.WriteAccess-label"]');
                if (labelEl) {
                  const text = labelEl.textContent.trim();
                  if (text.includes('무제한') || text.includes('Unrestricted')) {
                    isUpdated = true;
                    break;
                  }
                }
                await this.delay(300);
              }

              if (isUpdated) {
                this.log("[Role] 쓰기 액세스 권한이 성공적으로 '무제한'으로 변경 완료되었습니다.", 'success');
              } else {
                this.log("[경고] 쓰기 액세스 권한을 변경했으나 무제한으로의 반영을 감지하지 못했습니다.", 'error');
              }
            } else {
              this.log("[경고] '무제한' 옵션을 찾을 수 없습니다.", 'error');
            }
          } catch (e) {
            console.error('WriteAccess click error:', e);
          }
        } else {
          this.log("[경고] 쓰기 액세스 권한(select.WriteAccess) 요소를 찾지 못했습니다.", 'error');
        }
      } else {
        this.log("[Role] '쓰기 권한 무제한 설정' 체크박스가 비활성화되어 있어 권한 설정을 생략합니다.");
      }

      // 6. '비즈니스 사용자' 탭으로 이동하여 추가 팝업 띄우기
      const userTab = await this.findElement([
        '[id="application-BusinessUserRole-maintainNew-component---object--icontabfilter.brovbua"]',
        'Business Users', '비즈니스 사용자'
      ]);

      if (userTab) {
        await this.switchTab(userTab, '비즈니스 사용자');

        // 비즈니스 사용자 지정 헤더가 표시되는지 검증 (최대 5초)
        this.log("[Role] 비즈니스 사용자 정보 로드 대기 중...");
        const userHeader = await this.findElement([
          '#application-BusinessUserRole-maintainNew-component---object--tbhBUAssgnHdr-inner',
          '[id*="tbhBUAssgnHdr-inner"]'
        ], document, 5000);

        if (userHeader) {
          const headerText = userHeader.textContent.trim();
          this.log(`[Role] 비즈니스 사용자 지정 감지 완료: "${headerText}"`);
        } else {
          this.log("[경고] 지정된 비즈니스 사용자 표시 레이블을 감지하지 못했습니다.", 'error');
        }

        this.log("[Role] '추가' 버튼을 클릭하여 비즈니스 사용자 추가 다이얼로그를 엽니다.");
        const userAddBtn = await this.findElement([
          '[id="application-BusinessUserRole-maintainNew-component---object--button.BusinessUserAssignmentTableAdd"]',
          'Add', '추가'
        ]);

        if (userAddBtn) {
          this.clickElement(userAddBtn);
          await this.waitForUi5Busy();
          await this.delay(1000); // 팝업창 안정화 대기

          const userDlg = document.getElementById('addBusinessUserDialog');
          if (userDlg) {
            this.log("[Role] 비즈니스 사용자 추가 다이얼로그가 정상적으로 로드되었습니다.");
          }
        } else {
          this.log("[경고] 비즈니스 사용자 '추가' 버튼을 찾지 못했습니다.", 'error');
        }
      } else {
        this.log("[경고] '비즈니스 사용자' 탭을 찾지 못했습니다.", 'error');
      }

      this.log("[Role] 🎉 비즈니스 역할 자동 설정 단계가 완료되었습니다!", 'success');
    }

    // IAM App 생성 단계 (추후 확장용)
    async processIAMApp() {
      this.log(`[IAM] IAM App 생성 진행: ${this.config.iam_id}`);
      if (!window.location.hash.includes('CustomBusinessApp')) {
        window.location.hash = '#CustomBusinessApp-maintain';
        await this.delay(3000);
      }
      await this.waitForUi5Busy();
    }

    // Business Catalog 생성 단계 (추후 확장용)
    async processBusinessCatalog() {
      this.log(`[Catalog] Business Catalog 생성 진행: ${this.config.catalog_id}`);
      if (!window.location.hash.includes('CustomBusinessCatalog')) {
        window.location.hash = '#CustomBusinessCatalog-maintain';
        await this.delay(3000);
      }
      await this.waitForUi5Busy();
    }
  }

  // Global Expose for Direct Dynamic Execution
  window.startSapFioriAutomation = (config) => {
    const engine = new FioriDomAutomationEngine(config);
    engine.start();
  };

  // Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'RUN_FIORI_AUTOMATION') {
      const engine = new FioriDomAutomationEngine(request);
      engine.start();
      sendResponse({ started: true });
      return true;
    }
  });
})();
