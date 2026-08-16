// content/mainWorld.js - SAP Public Cloud Helper Main World Script (SAP UI5 Control API & CSP bypass)

(() => {
  console.log('[SAP Public Cloud Helper] Main World Script Injected & Executed.');

  class FioriUi5AutomationEngine {
    constructor(cfg) {
      this.config = cfg;
    }

    log(msg, type = 'info') {
      window.dispatchEvent(
        new CustomEvent('sap-automation-event', {
          detail: { action: 'log', msg, type },
        }),
      );
    }

    toast(msg) {
      window.dispatchEvent(
        new CustomEvent('sap-automation-event', {
          detail: { action: 'toast', toast: msg },
        }),
      );
    }

    async delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // SAP UI5 글로벌 BusyIndicator, 특정 중요 컴포넌트 Busy, OData 모델 Pending Requests를 종합 체크하여 대기 (Registry 루프 제거로 CPU 오버헤드 박멸)
    async waitForUi5(timeout = 8000) {
      const startTime = Date.now();
      await this.delay(100); // 변경 정보 인지 및 Busy 상태 진입 대기를 위한 미세 지연

      while (Date.now() - startTime < timeout) {
        let isBusy = false;

        // 1. 글로벌 BusyIndicator 확인
        if (typeof sap !== 'undefined' && sap.ui && sap.ui.core && sap.ui.core.BusyIndicator) {
          if (
            typeof sap.ui.core.BusyIndicator.isBusy === 'function' &&
            sap.ui.core.BusyIndicator.isBusy()
          ) {
            isBusy = true;
          }
        }

        // 2. 최상위 Fiori App 컨테이너 및 다이얼로그 Busy 여부만 타깃 검사 (순회 루프 없음)
        if (!isBusy && typeof sap !== 'undefined' && sap.ui && sap.ui.getCore) {
          const core = sap.ui.getCore();
          if (core) {
            // 다이얼로그 Busy 체크
            if (sap.m && sap.m.InstanceManager) {
              const dialogs = sap.m.InstanceManager.getOpenDialogs() || [];
              for (const dlg of dialogs) {
                if (dlg && typeof dlg.getBusy === 'function' && dlg.getBusy()) {
                  isBusy = true;
                  break;
                }
              }
            }

            // 최상위 컨테이너 Busy 체크
            if (!isBusy) {
              const appContainer = document.querySelector(
                '.sapUShellShell, .sapMApp, .sapUComponentContainer',
              );
              if (appContainer && appContainer.id) {
                const oAppCtrl = core.byId(appContainer.id);
                if (oAppCtrl && typeof oAppCtrl.getBusy === 'function' && oAppCtrl.getBusy()) {
                  isBusy = true;
                }
              }
            }
          }
        }

        // 3. OData Model의 Pending Request(백엔드 Draft 통신 중) 체크
        if (!isBusy && typeof sap !== 'undefined' && sap.ui && sap.ui.getCore) {
          const core = sap.ui.getCore();
          if (core) {
            const models =
              core.getComponent && core.getComponent() && core.getComponent().getModels
                ? core.getComponent().getModels()
                : core.mModels || {};

            for (const name in models) {
              const model = models[name];
              if (
                model &&
                typeof model.hasPendingRequests === 'function' &&
                model.hasPendingRequests()
              ) {
                isBusy = true;
                break;
              }
            }
          }
        }

        // 아무런 Busy 상태도 발견되지 않으면 즉시 완료 처리로 탈출
        if (!isBusy) {
          return true;
        }

        await this.delay(100);
      }
      return false;
    }

    // UI5 컨트롤 탐색 (DOM 쿼리 브릿지를 결합하여 루프 순회를 100% 제거)
    findControl(partialId) {
      if (typeof sap === 'undefined' || !sap.ui || !sap.ui.getCore) return null;
      const core = sap.ui.getCore();

      // 1. 정확한 ID로 우선 검색
      let oCtrl = core.byId(partialId);
      if (oCtrl) return oCtrl;

      // 2. DOM Selector Bridge: 브라우저 고속 CSS 쿼리로 해당 부분 ID를 가진 DOM을 얻고, ID 추출하여 1회에 획득
      const selector = `[id$="--${partialId}"], [id$="-${partialId}"], [id*="${partialId}"]`;
      const el = document.querySelector(selector);
      if (el && el.id) {
        oCtrl = core.byId(el.id);
        if (oCtrl) {
          return oCtrl;
        }
      }

      // 3. Fallback: 레지스트리 순회 (DOM에 아직 그려지지 않았을 경우 작동)
      const registry = (sap.ui.core.Element && sap.ui.core.Element.registry) || core.mElements;
      if (registry) {
        const allItems = registry.all ? registry.all() : registry;
        const keys = Object.keys(allItems);
        for (const key of keys) {
          if (key.indexOf(partialId) !== -1) {
            const ctrl = registry.get ? registry.get(key) : registry[key];
            if (ctrl) {
              return ctrl;
            }
          }
        }
      }
      return null;
    }

    // 가시성 및 활성화 상태 검사를 포함한 컨트롤 획득 대기 (폴링 100ms로 속도 최적화)
    // requireEnabled=false로 호출하면 getEnabled() 상태와 무관하게 존재 여부만으로 반환 (프로그램적 API 호출은 disabled 상태에서도 동작하기 때문)
    async waitForControl(partialId, timeout = 12000, requireEnabled = true) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const oCtrl = this.findControl(partialId);
        if (oCtrl) {
          const isEnabled = typeof oCtrl.getEnabled === 'function' ? oCtrl.getEnabled() : true;
          if (!requireEnabled || isEnabled) {
            return oCtrl;
          }
        }
        await this.delay(100);
      }
      return null;
    }

    // SAP UI5 IconTabBar용 탭 전환 및 재시도 헬퍼 함수
    async switchTab(tabCtrl, tabName = '탭', retries = 3) {
      if (!tabCtrl) return false;
      const parentBar = tabCtrl.getParent ? tabCtrl.getParent() : null;
      if (!parentBar || typeof parentBar.setSelectedKey !== 'function') {
        if (typeof tabCtrl.fireSelect === 'function') {
          tabCtrl.fireSelect();
          return true;
        }
        return false;
      }

      const key = tabCtrl.getKey ? tabCtrl.getKey() : '';

      for (let i = 1; i <= retries; i++) {
        try {
          this.log(`[Tab] '${tabName}' 탭으로 전환 시도 (${i}/${retries})...`);

          parentBar.setSelectedKey(key);
          parentBar.fireSelect({
            selectedItem: tabCtrl,
            selectedKey: key,
          });

          await this.waitForUi5();
          await this.delay(150);

          if (parentBar.getSelectedKey() === key) {
            this.log(`[Tab] '${tabName}' 탭 전환 성공.`, 'success');
            return true;
          }
        } catch (e) {
          this.log(`[Tab] 탭 전환 시도 중 경고: ${e.message}`, 'warning');
        }
        await this.delay(800);
      }

      throw new Error(`'${tabName}' 탭 전환에 최종 실패했습니다.`);
    }

    // 현재 선택된 항목의 텍스트가 '무제한'인지 확인하는 헬퍼 함수
    isUnrestrictedSelected(selectCtrl) {
      const selected =
        typeof selectCtrl.getSelectedItem === 'function' ? selectCtrl.getSelectedItem() : null;
      const text =
        (selected && typeof selected.getText === 'function' ? selected.getText() : '') || '';
      const upperText = text.toUpperCase();
      return (
        text.includes('무제한') ||
        upperText.includes('UNRESTRICTED') ||
        upperText.includes('UNLIMITED')
      );
    }

    // 셀렉트박스 권한 항목을 지능적으로 무제한으로 매핑 및 대기하는 헬퍼 함수
    // 비즈니스 카탈로그 등록 직후에는 값이 설정되어도 UI5 바인딩이 되돌리는 경우가 있어, 실제 반영을 확인할 때까지 최대 5회 재시도
    async setSelectToUnrestricted(selectCtrl, fieldName = '액세스 권한', maxAttempts = 5) {
      if (!selectCtrl) return;

      this.log(`[Role] '${fieldName}' 항목을 무제한으로 설정을 시작합니다.`);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // 셀렉트 박스가 활성화된 직후에도 items(Value Help) 목록은 비동기로 늦게 채워질 수 있어 최대 3초간 폴링 대기
        let items = [];
        const itemsWaitStart = Date.now();
        while (Date.now() - itemsWaitStart < 3000) {
          items = typeof selectCtrl.getItems === 'function' ? selectCtrl.getItems() : [];
          if (items.length > 0) break;
          await this.delay(150);
        }

        // 1) 항목의 실제 표시 텍스트로 '무제한' 항목을 탐색 (Key 값은 화면마다 달라질 수 있어 신뢰 불가)
        const unrestrictedItem = items.find((item) => {
          const text = (typeof item.getText === 'function' ? item.getText() : '') || '';
          const upperText = text.toUpperCase();
          return (
            text.includes('무제한') ||
            upperText.includes('UNRESTRICTED') ||
            upperText.includes('UNLIMITED')
          );
        });

        if (unrestrictedItem && typeof selectCtrl.setSelectedItem === 'function') {
          this.log(
            `[Role] (시도 ${attempt}/${maxAttempts}) 텍스트 매칭으로 '무제한' 항목(Key: ${typeof unrestrictedItem.getKey === 'function' ? unrestrictedItem.getKey() : '?'})을 찾았습니다.`,
          );
          selectCtrl.setSelectedItem(unrestrictedItem);
          if (
            typeof selectCtrl.setSelectedKey === 'function' &&
            typeof unrestrictedItem.getKey === 'function'
          ) {
            selectCtrl.setSelectedKey(unrestrictedItem.getKey());
          }
          selectCtrl.fireChange({ selectedItem: unrestrictedItem });
        } else if (items.length > 0 && typeof selectCtrl.setSelectedItem === 'function') {
          // 2) Fallback: 텍스트 매칭 실패 시에만 첫 번째 항목으로 대체 (기존 값과 동일할 수 있어 최후의 수단)
          this.log(
            `[Role] [경고] (시도 ${attempt}/${maxAttempts}) '무제한' 텍스트를 가진 항목을 찾지 못해 첫 번째 항목(Index 0)으로 대체 지정합니다.`,
            'warning',
          );
          selectCtrl.setSelectedItem(items[0]);
          selectCtrl.fireChange({ selectedItem: items[0] });
        } else {
          this.log(
            `[Role] [경고] (시도 ${attempt}/${maxAttempts}) '${fieldName}' 셀렉트 박스에서 선택 가능한 항목을 찾지 못했습니다.`,
            'warning',
          );
        }

        await this.waitForUi5();
        await this.delay(200);

        if (this.isUnrestrictedSelected(selectCtrl)) {
          this.log(
            `[Role] '${fieldName}' 항목이 '무제한'으로 반영된 것을 확인했습니다. (시도 ${attempt}/${maxAttempts})`,
            'success',
          );
          return;
        }

        if (attempt < maxAttempts) {
          this.log(
            `[Role] [경고] '${fieldName}' 값이 아직 '무제한'으로 반영되지 않았습니다. 재시도합니다...`,
            'warning',
          );
          await this.delay(400);
        }
      }

      this.log(
        `[Role] [경고] '${fieldName}' 항목을 '무제한'으로 설정하지 못했습니다. (최대 ${maxAttempts}회 시도 후 포기)`,
        'warning',
      );
    }

    async start() {
      try {
        if (this.config.mode === 'CATALOG_EXT') {
          await this.processCatalogExtension();
          this.log('사용자 정의 카탈로그 확장 자동화 작업이 성공적으로 수행되었습니다!', 'success');
          this.toast('사용자 정의 카탈로그 확장 설정 완료! 화면 하단 [저장] 버튼을 눌러주세요.');
        } else {
          if (this.config.role_id) {
            await this.processBusinessRole();
          }
          this.log(
            '비즈니스 역할 수동 저장을 제외한 자동화 작업이 성공적으로 수행되었습니다!',
            'success',
          );
          this.toast('비즈니스 역할 설정 완료! 화면 하단 [저장] 버튼을 눌러주세요.');
        }
      } catch (err) {
        this.log(`오류 발생: ${err.message}`, 'error');
        console.error('[SAP Helper Automation Error]', err);
      }
    }

    // --- 사용자 정의 카탈로그 확장 (Custom Catalog Extension) 매크로 ---
    async processCatalogExtension() {
      const rawId = this.config.iam_id || '';
      if (!rawId) {
        throw new Error('app.name(IAM App ID) 입력값이 없습니다.');
      }

      let iamId = rawId.trim().toUpperCase();
      if (!iamId.startsWith('YY1_')) {
        iamId = 'YY1_' + iamId;
      }
      if (!iamId.endsWith('_UI5R')) {
        iamId = iamId + '_UI5R';
      }

      this.log(`[CatalogExt] 사용자 정의 카탈로그 확장 처리 시작: ID=${iamId}`);

      // 1. 화면 해시 이동
      const targetHash = `#CustomCatalogExtension-maintain&/aps_iam_app_bcat_ddl/${iamId}`;
      if (
        !window.location.hash.includes(
          `CustomCatalogExtension-maintain&/aps_iam_app_bcat_ddl/${iamId}`,
        )
      ) {
        this.log(`[CatalogExt] 화면으로 이동합니다...`);
        window.location.hash = targetHash;
        await this.delay(1000);
      }
      await this.waitForUi5();

      // 2. 화면 로드 대기 검증 (Title 컨트롤 유무로 판별)
      this.log(`[CatalogExt] 화면 로드 대기 중...`);
      const titleCtrl = await this.waitForControl('details--businesscatalogtitle', 10000);
      if (!titleCtrl) {
        const errorCtrl = this.findControl('objectNotFound--page-text');
        if (errorCtrl && typeof errorCtrl.getText === 'function') {
          throw new Error(`이동 실패: ${errorCtrl.getText()}`);
        }
        throw new Error('화면 로드 타임아웃 또는 실패');
      }
      this.log(`[CatalogExt] 카탈로그 확장 상세 화면 진입 완료.`, 'success');

      // 3. '추가' 버튼 클릭
      const addBtn = await this.waitForControl('details--buttonAddCatalogRole');
      if (!addBtn) {
        throw new Error("'추가' 버튼을 찾을 수 없습니다.");
      }
      this.log(`[CatalogExt] '추가' 버튼 클릭...`);
      addBtn.firePress();
      await this.waitForUi5();
      await this.delay(200);

      // 4. 역할 선택 다이얼로그에서 역할 검색 및 다중 체크 진행
      const rolesInput = this.config.catalog_roles || '';
      const targetRoles = rolesInput
        ? rolesInput
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean)
        : ['SAP_CORE_BC_EXT_CBO', 'SAP_CORE_BC_EXT_UI'];

      for (const roleId of targetRoles) {
        this.log(`[CatalogExt] 역할 검색창에 입력: ${roleId}`);
        const searchField = await this.waitForControl('selectCatalogRolesDialog-searchField');
        if (!searchField) {
          throw new Error('역할 선택 다이얼로그의 검색창을 찾지 못했습니다.');
        }

        searchField.setValue(roleId);
        searchField.fireSearch({ query: roleId });
        await this.waitForUi5();
        await this.delay(300);

        // 테이블 아이템을 뒤져 100% 텍스트 일치 행 선택
        const table = this.findControl('selectCatalogRolesDialog-table');
        if (!table) {
          this.log(`[CatalogExt] [경고] 검색 결과 테이블을 찾을 수 없습니다.`, 'error');
          continue;
        }

        const items = table.getItems ? table.getItems() : [];
        let checked = false;

        for (const item of items) {
          const cells = item.getCells ? item.getCells() : [];
          let isExactMatch = false;

          for (const cell of cells) {
            if (typeof cell.getText === 'function' && cell.getText().trim() === roleId) {
              isExactMatch = true;
              break;
            }
            if (typeof cell.getTitle === 'function' && cell.getTitle().trim() === roleId) {
              isExactMatch = true;
              break;
            }
          }

          if (isExactMatch) {
            const isSelected = item.getSelected ? item.getSelected() : false;
            if (!isSelected) {
              this.log(`[CatalogExt] 역할 '${roleId}' 행을 선택합니다.`);
              table.setSelectedItem(item, true);
              table.fireSelectionChange({ listItem: item, selected: true, listItems: [item] });
              await this.delay(100);
            } else {
              this.log(`[CatalogExt] 역할 '${roleId}'는 이미 선택되어 있습니다.`);
            }
            checked = true;
            break;
          }
        }

        if (!checked) {
          this.log(
            `[CatalogExt] [경고] 검색 결과에서 역할 '${roleId}'를 찾지 못했습니다.`,
            'error',
          );
        }
      }

      // 최종 "확인" 버튼 클릭하여 다이얼로그 설정 반영
      const okBtn = await this.waitForControl('selectCatalogRolesDialog-ok');
      if (okBtn) {
        this.log("[CatalogExt] 다이얼로그 '확인' 버튼을 클릭하여 추가합니다.");
        okBtn.firePress();
        await this.waitForUi5();
        await this.delay(300);
      } else {
        throw new Error("다이얼로그 '확인' 버튼을 찾을 수 없습니다.");
      }

      // 5. 최종 '게시 (Publish)' 진행
      // 메인 테이블의 '모두 선택' 체크박스 클릭
      const detailsTable = this.findControl('details--businesscatalogTable');
      if (detailsTable) {
        this.log(
          "[CatalogExt] 테이블 헤더의 '모두 선택' 체크박스를 클릭하여 역할을 전체 선택합니다.",
        );
        if (typeof detailsTable.selectAll === 'function') {
          detailsTable.selectAll();
          detailsTable.fireSelectionChange({ selectAll: true });
        } else {
          const items = detailsTable.getItems ? detailsTable.getItems() : [];
          items.forEach((item) => {
            if (typeof item.setSelected === 'function') item.setSelected(true);
          });
          detailsTable.fireSelectionChange({ listItems: items });
        }
        await this.delay(100);
      } else {
        this.log("[경고] '모두 선택' 체크박스(businesscatalogTable)를 찾지 못했습니다.", 'error');
      }

      // '게시' 버튼 활성화 대기 및 클릭
      const publishBtn = await this.waitForControl('buttonActiveCatalogRol');
      if (publishBtn) {
        this.log("[CatalogExt] '게시' 버튼을 클릭합니다.");
        publishBtn.firePress();
        await this.waitForUi5();
        await this.delay(300);

        // 게시 확인 MessageBox (Dialog) 동적 감지
        let confirmPublishBtn = null;
        const searchMboxStartTime = Date.now();
        while (Date.now() - searchMboxStartTime < 4000) {
          const dialogs = sap.m.InstanceManager.getOpenDialogs();
          for (const dlg of dialogs) {
            const btns = dlg.getButtons ? dlg.getButtons() : [];
            for (const btn of btns) {
              const hasGetText = btn.getText && typeof btn.getText === 'function';
              const txt = hasGetText ? (btn.getText() || '').toUpperCase() : '';
              if (
                txt.includes('확인') ||
                txt.includes('OK') ||
                txt.includes('YES') ||
                txt.includes('예')
              ) {
                confirmPublishBtn = btn;
                break;
              }
            }
            if (confirmPublishBtn) break;
          }
          if (confirmPublishBtn) break;
          await this.delay(50);
        }

        if (confirmPublishBtn) {
          this.log("[CatalogExt] 게시 확인 다이얼로그의 '게시/확인' 버튼을 클릭합니다.");
          confirmPublishBtn.firePress();
          await this.waitForUi5();
          await this.delay(500);
        }

        // 최종 새로 고침 버튼 클릭
        const refreshBtn = this.findControl('buttonDetailsRefresh');
        if (refreshBtn) {
          this.log("[CatalogExt] '새로 고침' 버튼을 클릭합니다.");
          refreshBtn.firePress();
          await this.waitForUi5();
          await this.delay(200);
        }
        this.log('[CatalogExt] 최종 게시 처리가 성공적으로 완료되었습니다.', 'success');
      } else {
        this.log("[경고] '게시' 버튼을 찾지 못했습니다.", 'error');
      }
    }

    // --- 비즈니스 역할 유지보수 (Maintain Business Roles) 매크로 ---
    async processBusinessRole() {
      const roleId = this.config.role_id;
      const roleTitle = this.config.role_desc || roleId;
      const catalogId = this.config.catalog_id;

      this.log(`[Role] 비즈니스 역할 처리 시작: ID=${roleId}`);

      // 현재 사용자가 직접 역할을 클릭해 들어가서 '편집' 버튼까지 누른 상세 편집 화면인지 판정
      const isAlreadyInDetails =
        window.location.hash.includes('maintainNew') &&
        !this.findControl('btnFooterMainAction') &&
        this.findControl('iconTabFilter.BusinessCatalog');

      if (isAlreadyInDetails) {
        this.log(
          '[Role] 이미 기존 역할의 상세 편집 화면에 수동으로 진입해 있는 상태를 감지했습니다.',
        );
        this.log('[Role] 신규 생성 절차를 건너뛰고 카탈로그 추가 단계로 직행합니다.');
      } else {
        // 1. 화면 해시 이동
        const targetHash = '#BusinessUserRole-maintainNew';
        if (!window.location.hash.includes('BusinessUserRole-maintainNew')) {
          this.log(`[Role] 'Maintain Business Roles' 화면으로 이동합니다...`);
          window.location.hash = targetHash;
          await this.delay(1000);
        }
        await this.waitForUi5();

        // 2. '신규' 버튼 탐색 및 클릭
        this.log("[Role] 신규 역할 생성을 위해 '신규' 버튼을 탐색합니다...");
        const createBtn = await this.waitForControl('btnFooterMainAction');
        if (!createBtn) {
          throw new Error("'신규' 버튼을 찾을 수 없습니다.");
        }

        this.log("[Role] '신규' 버튼 클릭...");
        createBtn.firePress();
        await this.waitForUi5();
        await this.delay(300);

        // 다이얼로그 로드 및 필드 감지
        const roleIdInput = await this.waitForControl('RoleIdInput');
        const roleDescInput = await this.waitForControl('RoleDescInput');

        if (roleIdInput && roleDescInput) {
          this.log(`[Role] 비즈니스 역할 ID 기입 중: ${roleId}`);
          roleIdInput.setValue(roleId);
          roleIdInput.fireChange({ value: roleId, newValue: roleId });

          this.log(`[Role] 비즈니스 역할 내역 기입 중: ${roleTitle}`);
          roleDescInput.setValue(roleTitle);
          roleDescInput.fireChange({ value: roleTitle, newValue: roleTitle });

          await this.delay(100);

          // 비동기 OData Validation 및 중복 검사 대기 (최대 2초 폴링)
          let isDuplicate = false;
          const checkStartTime = Date.now();
          while (Date.now() - checkStartTime < 2000) {
            if (roleIdInput.getValueState && roleIdInput.getValueState() === 'Error') {
              isDuplicate = true;
              break;
            }
            await this.delay(100);
          }

          if (isDuplicate) {
            this.log(
              '[Role] 중복 역할 감지 (예약된 ID 또는 생성 비활성화). 다이얼로그를 취소하고 메인 화면에서 검색 후 자동화를 조기 종료합니다.',
              'error',
            );
            const cancelBtn = this.findControl('newBusinessRoleDialogCancelBtn');
            if (cancelBtn) {
              this.log('[Role] 생성 다이얼로그 취소 버튼을 클릭합니다.');
              cancelBtn.firePress();
              await this.waitForUi5();
              await this.delay(100);
            }

            // 메인 화면 검색창에 역할 ID 입력 및 검색 실행
            this.log(`[Role] 메인 화면 필터바에서 역할 ID(${roleId}) 검색을 시도합니다...`);
            const filterSearchInput = this.findControl('FilterBar-btnBasicSearch');
            if (filterSearchInput) {
              filterSearchInput.setValue(roleId);
              if (typeof filterSearchInput.fireSearch === 'function') {
                filterSearchInput.fireSearch({ query: roleId });
              } else if (typeof filterSearchInput.fireChange === 'function') {
                filterSearchInput.fireChange({ value: roleId, newValue: roleId });
              }

              const goBtn = this.findControl('FilterBar-btnGo');
              if (goBtn) {
                this.log('[Role] 검색 실행 버튼을 클릭합니다.');
                goBtn.firePress();
                await this.waitForUi5();
                await this.delay(500);
              }
            }
            return; // 자동화 조기 종료
          }

          // '생성' 버튼 클릭
          const dialogCreateBtn = await this.waitForControl('newBusinessRoleDialogCreateBtn');
          if (dialogCreateBtn) {
            this.log("[Role] 다이얼로그 '생성' 버튼 클릭...");
            dialogCreateBtn.firePress();
            await this.waitForUi5();

            // 상세화면 로드 대기 (아이콘 탭 필터 감지)
            this.log('[Role] 상세 보기 화면 로드 대기 중...');
            await this.waitForControl('iconTabFilter.BusinessCatalog', 10000);
            await this.waitForUi5();
            await this.delay(200);
          }
        }
      }

      // 상세화면 로드 후 '편집' 모드가 활성화되어 있지 않고 '편집' 버튼이 노출되어 있다면 클릭
      const editBtn = this.findControl('button.BusinessRolePageEditRole-button');
      if (editBtn) {
        const isEnabled = typeof editBtn.getEnabled === 'function' ? editBtn.getEnabled() : true;
        const isVisible = typeof editBtn.getVisible === 'function' ? editBtn.getVisible() : true;
        if (isVisible && isEnabled) {
          this.log(
            "[Role] 기존에 저장 완료된 역할 상태이므로 '편집' 버튼을 클릭하여 수정 모드로 진입합니다.",
          );
          editBtn.firePress();
          await this.waitForUi5();
          await this.delay(500);
        }
      }

      // 3. Business Catalog 탭으로 이동 및 카탈로그 추가
      if (catalogId) {
        const catalogIds = catalogId
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        this.log(`[Role] 파싱된 카탈로그 ID 목록: [${catalogIds.join(', ')}]`);

        const catalogTab = await this.waitForControl('iconTabFilter.BusinessCatalog');
        if (catalogTab) {
          await this.switchTab(catalogTab, '비즈니스 카탈로그');
        }

        const addBtn = await this.waitForControl('button.BusinessCatalogAssignmentTableAdd');
        if (addBtn) {
          this.log('[Role] 카탈로그 추가 버튼을 클릭합니다.');
          addBtn.firePress();
          await this.waitForUi5();
          await this.delay(200);

          // 다이어로그 내의 테이블 스위치 끄기 조작 (sap.m.Switch)
          const tableSwitch = await this.waitForControl('switch.AddBusinessCatalogAssignmentTable');
          if (tableSwitch) {
            this.log("[Role] 카탈로그 추가 테이블 스위치를 '꺼짐(Off)'으로 설정합니다.");
            if (typeof tableSwitch.setState === 'function') {
              tableSwitch.setState(false);
            }
            if (typeof tableSwitch.fireChange === 'function') {
              tableSwitch.fireChange({ state: false });
            }
            await this.waitForUi5();
            await this.delay(200);
          }

          // 다중 ID 순회 검색 및 누적 체크박스 선택 & 적용(종속성 포함)
          for (const targetCatalogId of catalogIds) {
            const searchInput = await this.waitForControl(
              'searchField.AddBusinessCatalogAssignmentTable',
            );
            if (searchInput) {
              this.log(`[Role] 카탈로그 검색창에 (${targetCatalogId}) 검색 입력...`);
              searchInput.setValue(targetCatalogId);
              searchInput.fireSearch({ query: targetCatalogId });
              await this.waitForUi5();
              await this.delay(300);

              const table =
                this.findControl('table.AddBusinessCatalogAssignment') ||
                this.findControl('AddBusinessCatalogAssignmentTable');
              if (table) {
                // 테이블 바인딩 완료 대기 (최대 5초)
                const bindStartTime = Date.now();
                while (Date.now() - bindStartTime < 5000) {
                  if (table.getItems && table.getItems().length > 0) break;
                  await this.delay(100);
                }

                const items = table.getItems ? table.getItems() : [];
                let targetCheck = null;

                for (const item of items) {
                  const cells = item.getCells ? item.getCells() : [];
                  let isExactMatch = false;

                  for (const cell of cells) {
                    const hasGetText = cell.getText && typeof cell.getText === 'function';
                    const hasGetTitle = cell.getTitle && typeof cell.getTitle === 'function';
                    const text = hasGetText ? cell.getText() || '' : '';
                    const title = hasGetTitle ? cell.getTitle() || '' : '';

                    if (
                      text.trim() === targetCatalogId ||
                      title.trim() === targetCatalogId ||
                      text.indexOf(targetCatalogId) !== -1 ||
                      title.indexOf(targetCatalogId) !== -1
                    ) {
                      isExactMatch = true;
                      break;
                    }
                  }
                  if (isExactMatch) {
                    targetCheck = item;
                    break;
                  }
                }

                if (targetCheck) {
                  this.log(
                    `[Role] 일치하는 비즈니스 카탈로그 행(${targetCatalogId})을 선택합니다.`,
                  );
                  if (typeof targetCheck.setSelected === 'function') {
                    targetCheck.setSelected(true);
                  }
                  table.setSelectedItem(targetCheck, true);
                  table.fireSelectionChange({
                    listItem: targetCheck,
                    selected: true,
                    listItems: [targetCheck],
                  });

                  // Hybrid Fallback: 물리적 DOM 체크박스 클릭 트리거 (100% 확실한 체크박스 활성화 보장)
                  const itemEl = targetCheck.getDomRef ? targetCheck.getDomRef() : null;
                  if (itemEl) {
                    const cb = itemEl.querySelector(
                      '.sapMCb, input[type="checkbox"], .sapMListTblSelCol',
                    );
                    if (cb) {
                      cb.click();
                    }
                  }
                  await this.delay(300);

                  // 1. 적용(Apply) 버튼을 동적으로 찾아서 클릭
                  let applyBtn = null;
                  const core = sap.ui.getCore ? sap.ui.getCore() : null;
                  const registry =
                    (sap.ui.core.Element && sap.ui.core.Element.registry) ||
                    (core && core.mElements);
                  if (registry) {
                    const allItems = registry.all ? registry.all() : registry;
                    const keys = Object.keys(allItems);
                    for (const key of keys) {
                      if (key.indexOf('AddBusinessCatalogAssignmentDialog') !== -1) {
                        const ctrl = registry.get ? registry.get(key) : registry[key];
                        if (ctrl && ctrl.getText && typeof ctrl.getText === 'function') {
                          const txt = ctrl.getText().toUpperCase();
                          if (txt.includes('적용') || txt.includes('APPLY')) {
                            applyBtn = ctrl;
                            break;
                          }
                        }
                      }
                    }
                  }

                  if (applyBtn) {
                    this.log(`[Role] 카탈로그 적용(Apply) 버튼을 클릭합니다 (${targetCatalogId}).`);
                    applyBtn.firePress();
                    await this.waitForUi5();
                    await this.delay(500);
                  }

                  // 2. 종속성 다이얼로그 탐색 및 자동화 처리
                  let dependencyDlg = null;
                  if (sap.m && sap.m.InstanceManager) {
                    const dialogs = sap.m.InstanceManager.getOpenDialogs() || [];
                    for (const dlg of dialogs) {
                      const title = dlg.getTitle ? dlg.getTitle() || '' : '';
                      if (
                        title.indexOf('종속') !== -1 ||
                        title.toUpperCase().indexOf('DEPENDENCY') !== -1
                      ) {
                        dependencyDlg = dlg;
                        break;
                      }
                    }
                  }

                  if (dependencyDlg) {
                    this.log(
                      '[Role] 카탈로그 종속성 다이얼로그가 감지되었습니다. 종속성은 체크 제외하고 즉시 적용합니다.',
                    );

                    // 최종 '적용' 또는 '확인' 버튼 클릭하여 종속성 다이얼로그 즉시 닫기
                    let applyDepBtn = null;
                    const buttons = dependencyDlg.getButtons ? dependencyDlg.getButtons() : [];
                    for (const btn of buttons) {
                      const txt = btn.getText ? (btn.getText() || '').toUpperCase() : '';
                      if (
                        txt.includes('적용') ||
                        txt.includes('확인') ||
                        txt.includes('OK') ||
                        txt.includes('APPLY')
                      ) {
                        if (btn.getEnabled && btn.getEnabled()) {
                          applyDepBtn = btn;
                          break;
                        }
                      }
                    }

                    if (applyDepBtn) {
                      this.log('[Role] 종속성 적용 버튼을 클릭합니다.');
                      applyDepBtn.firePress();
                      await this.waitForUi5();
                      await this.delay(300);
                    }
                  }
                } else {
                  this.log(
                    `[경고] 일치하는 비즈니스 카탈로그(${targetCatalogId})를 테이블에서 찾지 못했습니다.`,
                    'warning',
                  );
                }
              }
            }
          }

          // 모든 카탈로그와 종속성 추가 완료 후, 최종적으로 다이얼로그를 닫아줌 (취소 클릭)
          const cancelBtn = this.findControl('button.AddBusinessCatalogAssignmentDialogCancel');
          if (cancelBtn) {
            this.log('[Role] 카탈로그 다이얼로그를 닫습니다 (취소/닫기 버튼 클릭).');
            cancelBtn.firePress();
            await this.waitForUi5();
            await this.delay(200);
          }
        }
      }

      // 4. 일반 역할 세부사항 탭으로 이동하여 무제한 설정
      if (this.config.role_unrestricted) {
        const generalTab = await this.waitForControl('icontabfilter.brov');
        if (generalTab) {
          await this.switchTab(generalTab, '일반 역할 세부사항');
        }

        // 셀렉트 박스 컨트롤이 완전히 렌더링될 때까지 최대 5초 대기 (getEnabled() 상태는 요구하지 않음 - disabled 상태에서도 프로그램적 선택 API는 정상 동작)
        var oSelect = await this.waitForControl('select.WriteAccess', 5000, false);
        if (oSelect) {
          await this.setSelectToUnrestricted(oSelect, '쓰기 액세스 권한(WriteAccess)');
        } else {
          this.log(
            '[경고] 무제한 설정을 위한 select.WriteAccess 컨트롤을 탐색하지 못했습니다.',
            'warning',
          );
        }
      }

      this.log('[Role] 비즈니스 역할 자동 설정 단계가 완료되었습니다!', 'success');
    }
  }

  // Config Bridge 요소를 탐색하여 설정값 복구 및 자동화 구동
  const bridgeEl = document.getElementById('sap-helper-config-bridge');
  if (bridgeEl && bridgeEl.dataset.config) {
    try {
      const config = JSON.parse(bridgeEl.dataset.config);
      bridgeEl.remove(); // Config Bridge Clean-up

      // 자동화 시작 전 SAP UI5 체크
      if (typeof sap === 'undefined' || !sap.ui || !sap.ui.getCore) {
        console.error('[SAP Helper] SAP UI5 Core unavailable in Main World');
        window.dispatchEvent(
          new CustomEvent('sap-automation-event', {
            detail: {
              action: 'log',
              msg: '오류: SAP UI5 프레임워크가 메인 윈도우에서 로드되지 않았습니다. Fiori 화면에서 시도해 주세요.',
              type: 'error',
            },
          }),
        );
      } else {
        const engine = new FioriUi5AutomationEngine(config);
        engine.start();
      }
    } catch (e) {
      console.error('[SAP Helper] Config parse error in Main World:', e);
    }
  }

  // SAP Fiori 상단 정보 주입 및 프로필 치환 로직
  function runProfileInformationInjector() {
    // UI5 프레임워크가 완전히 로드될 때까지 대기
    if (
      typeof sap === 'undefined' ||
      !sap.ui ||
      !sap.ui.getCore ||
      !sap.ushell ||
      !sap.ushell.Container
    ) {
      setTimeout(runProfileInformationInjector, 500);
      return;
    }

    // Fiori Shell UI 화면이 실제로 그려질 때까지 대기 (화면 생성 완료 대기)
    const shellHeader =
      document.getElementById('shell-header') || document.querySelector('.sapUShellShell');
    if (!shellHeader) {
      setTimeout(runProfileInformationInjector, 500);
      return;
    }

    let userInfo = null;
    function fetchUserInfo() {
      if (userInfo) return userInfo;
      try {
        const service = sap.ushell.Container.getService('UserInfo');
        const user = service.getUser();
        if (user) {
          userInfo = {
            email: user.getEmail() || '',
            name: user.getFullName() || user.getId() || '',
            id: user.getId() || '',
          };
          console.log('[SAP Helper] Fetched user info:', userInfo);
        }
      } catch (e) {
        // 아직 로딩 중일 수 있으므로 실패 시 null 유지
      }
      return userInfo;
    }

    // 화면 최상단 자주색 배너 띠를 동적으로 삽입해 주는 헬퍼 함수
    function injectTopBannerBar(fullText) {
      let banner = document.getElementById('sap-helper-top-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sap-helper-top-banner';
        banner.style.cssText = `
          background-color: #6b0c36; /* Fiori 자주색 테마 */
          color: #ffffff;
          text-align: center;
          font-size: 11px;
          font-weight: bold;
          padding: 3px 0;
          width: 100%;
          position: relative;
          z-index: 99999;
          border-bottom: 1px solid #4a0523;
        `;
        document.body.insertBefore(banner, document.body.firstChild);
      }
      if (banner.innerText !== fullText) {
        banner.innerText = fullText;
      }
    }

    // BFS를 통해 특정 키워드를 품은 상단 60px 이내의 말단 요소를 탐색하는 헬퍼 함수
    function findSystemInfoElementDeep(root, keywords) {
      const queue = [root];
      while (queue.length > 0) {
        const node = queue.shift();
        if (!node) continue;

        const text = node.innerText || '';
        if (keywords.some((k) => text.includes(k))) {
          let foundInChild = false;
          if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
              const childText = node.children[i].innerText || '';
              if (keywords.some((k) => childText.includes(k))) {
                foundInChild = true;
                break;
              }
            }
          }
          if (!foundInChild) {
            const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
            if (rect && rect.top >= 0 && rect.top < 60 && rect.height > 0 && rect.height < 60) {
              return node;
            }
          }
        }

        if (node.shadowRoot) {
          const sc = node.shadowRoot.children;
          if (sc) {
            for (let i = 0; i < sc.length; i++) {
              queue.push(sc[i]);
            }
          }
        }
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            queue.push(node.children[i]);
          }
        }
      }
      return null;
    }

    // 1초마다 정보를 확인하고 화면 요소들을 덮어씀
    setInterval(() => {
      const user = fetchUserInfo();
      if (!user) return;

      // 시스템 정보 획득을 위한 검색 키워드 정의
      let keywords = ['TEST', 'HD8/100', 'HD8', '100'];
      const host = window.location.hostname;
      const tenantMatch = host.match(/my\d+/);
      if (tenantMatch) {
        keywords.push(tenantMatch[0].toUpperCase());
      }

      // 시스템 정보 획득 시도 (표준 셀렉터 -> Deep Search 순)
      let infoBar = document.querySelector(
        '.sapUshellSystemInfoBar, .sapUshellSysInfoBar, [id*="SystemInfoBar"], [id*="SysInfoBar"], [class*="SystemInfoBar"], [class*="SysInfoBar"]',
      );
      if (!infoBar) {
        infoBar = findSystemInfoElementDeep(document.body, keywords);
      }

      let sysInfo = '';
      if (infoBar) {
        // textBdi가 있으면 전체 innerText 대신 textBdi의 원래 값만 참고 (subTextBdi 혼입 방지)
        const textBdi = infoBar.querySelector('[id*="-text-bdi"]');
        const rawText = textBdi ? textBdi.innerText : infoBar.innerText;

        if (rawText) {
          if (rawText.includes(user.email)) {
            sysInfo = rawText.split(' - ')[0].trim();
          } else {
            // 줄바꿈이 포함된 경우 첫 줄만 가져와 무한 증식 방지
            sysInfo = rawText.split('\n')[0].trim();
          }
        }
      }

      if (!sysInfo) {
        try {
          const system = sap.ushell.Container.getLogonSystem();
          if (system) {
            sysInfo = system.getName() || system.getClient() || '';
          }
        } catch (e) {}
      }
      if (!sysInfo) sysInfo = 'S4HANA'; // 기본값

      const fullText = `${sysInfo} - ${user.name} - ${user.email}`;

      // [방안 A] Fiori 상단 시스템 배너 영역 덮어쓰기
      if (infoBar) {
        // 기존에 임시로 삽입된 배너 띠가 있다면 제거하여 겹침 방지
        const manualBanner = document.getElementById('sap-helper-top-banner');
        if (manualBanner) {
          manualBanner.remove();
        }

        // UI5 DOM 구조 파괴를 방지하기 위해 전체 innerText를 덮어쓰지 않고, 내부 bdi 요소들의 텍스트만 안전하게 치환
        const textBdi = infoBar.querySelector('[id*="-text-bdi"]');
        const subTextBdi = infoBar.querySelector('[id*="-subText-bdi"]');

        if (textBdi && subTextBdi) {
          if (textBdi.innerText !== sysInfo) {
            textBdi.innerText = sysInfo;
          }

          // 기존 subTextBdi 값에서 클라이언트 정보(H3G/100 등)를 보존하고 그 뒤에 유저 정보를 추가
          let clientInfo = '';
          const rawSubText = subTextBdi.innerText.trim();
          if (rawSubText.includes(user.email)) {
            clientInfo = rawSubText.split(' - ')[0];
          } else {
            clientInfo = rawSubText;
          }

          const subTextContent = `${clientInfo} - ${user.name} - ${user.email}`;
          if (subTextBdi.innerText !== subTextContent) {
            subTextBdi.innerText = subTextContent;
          }

          // 정보창 ⓘ 아이콘 추가 및 이벤트 바인딩
          let infoTrigger = subTextBdi.parentNode.querySelector('#sap-helper-info-trigger');
          if (!infoTrigger) {
            infoTrigger = document.createElement('span');
            infoTrigger.id = 'sap-helper-info-trigger';
            infoTrigger.innerText = ' ⓘ';
            infoTrigger.style.cssText = `
              cursor: pointer;
              margin-left: 4px;
              color: #ffffff;
              font-weight: bold;
              display: inline-block;
              transition: transform 0.2s ease;
            `;

            infoTrigger.style.transform = 'scale(1)';
            infoTrigger.addEventListener('mouseenter', () => {
              infoTrigger.style.transform = 'scale(1.2)';
            });
            infoTrigger.addEventListener('mouseleave', () => {
              infoTrigger.style.transform = 'scale(1)';
            });

            infoTrigger.addEventListener('click', (e) => {
              e.stopPropagation();

              // 내부 클릭 헬퍼 함수 정의
              function clickTarget(aboutDom) {
                if (!aboutDom) return;
                const innerTarget = aboutDom.shadowRoot
                  ? aboutDom.shadowRoot.querySelector('li')
                  : null;
                if (innerTarget) {
                  innerTarget.click();
                } else {
                  setTimeout(() => {
                    const retryTarget = aboutDom.shadowRoot
                      ? aboutDom.shadowRoot.querySelector('li')
                      : aboutDom;
                    retryTarget?.click();
                  }, 50);
                }
              }

              // 프로필 및 정보 버튼 자동 클릭 트리거
              const profileDom =
                document.querySelector('#meAreaHeaderButton') ||
                document.querySelector('#userActionsMenuHeaderButton') ||
                document.querySelector('[id*="userActionsMenuHeaderButton"]');

              if (!profileDom) {
                console.log('[SAP Helper] 프로필 버튼 DOM을 찾을 수 없습니다.');
                return;
              }

              const existingAbout = document.querySelector('[text="정보"]');
              if (existingAbout) {
                clickTarget(existingAbout);
                return;
              }

              const observer = new MutationObserver((mutations, obs) => {
                const aboutDom = document.querySelector('[text="정보"]');
                if (aboutDom) {
                  obs.disconnect();
                  requestAnimationFrame(() => {
                    clickTarget(aboutDom);
                  });
                }
              });

              observer.observe(document.body, { childList: true, subtree: true });
              profileDom.click();
              setTimeout(() => observer.disconnect(), 2000);
            });

            subTextBdi.parentNode.appendChild(infoTrigger);
          }
        } else {
          // bdi 구조를 찾지 못한 경우에만 차선책으로 innerText 통째 치환
          if (infoBar.innerText !== fullText) {
            infoBar.innerText = fullText;
          }
        }
      } else {
        // 배너를 찾지 못했으므로 최상단에 강제로 배너 띠를 주입하여 항상 노출시킴
        injectTopBannerBar(fullText);
      }

      // [방안 B] 프로필 팝오버 메뉴 내 이름 덮어쓰기 (열렸을 때)
      const popovers = document.querySelectorAll(
        'ui5-popover, ui5-responsive-popover, .sapMPopover, [id*="popover"]',
      );
      for (const popover of popovers) {
        const isVisible =
          popover.hasAttribute('open') ||
          popover.classList.contains('sapMPopoverOpen') ||
          (popover.style &&
            popover.style.display !== 'none' &&
            popover.style.visibility !== 'hidden');
        if (isVisible) {
          replaceProfileNameInContainer(popover, user.name, fullText);
        }
      }
    }, 1000);
  }

  function replaceProfileNameInContainer(root, targetName, newText) {
    const queue = [root];
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) continue;

      // Shadow Root 내부 자식 추가
      if (node.shadowRoot) {
        const children = node.shadowRoot.children;
        if (children) {
          for (let i = 0; i < children.length; i++) {
            queue.push(children[i]);
          }
        }
      }

      // 일반 자식 노드 추가
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          queue.push(node.children[i]);
        }
      }

      // 1. Web Component 특수 속성 (text, title, heading 등) 매칭 및 치환
      if (node.getAttribute) {
        ['text', 'title', 'heading', 'subtitle'].forEach((attr) => {
          const val = node.getAttribute(attr);
          if (val && val.trim() === targetName && val !== newText) {
            node.setAttribute(attr, newText);
          }
        });
      }

      // 2. 일반 텍스트 노드 매칭 및 치환
      if (
        node.children &&
        node.children.length === 0 &&
        (!node.shadowRoot || node.shadowRoot.children.length === 0)
      ) {
        if (
          node.textContent &&
          node.textContent.trim() === targetName &&
          node.textContent !== newText
        ) {
          node.textContent = newText;
        }
      }
    }
  }

  // 주입 실행
  runProfileInformationInjector();
})();
