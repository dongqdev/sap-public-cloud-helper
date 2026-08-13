# SAP Public Cloud Helper (S/4HANA Cloud Assistant)

> **SAP S/4HANA Cloud (Public Edition) 개발자와 사용자를 위한 테넌트 관리 및 Fiori 자동화 헬퍼 크롬 확장 프로그램**  
> 복잡한 테넌트 관리부터 비즈니스 역할(Role) & 사용자 정의 카탈로그 확장(Custom Catalog Extension) 매크로, 세션 정리를 위한 쿠키 일괄 삭제까지 하나의 확장 프로그램으로 해결하세요!

---

## 🌟 주요 기능 (Key Features)

### 🏢 1. 멀티 테넌트 관리 및 원클릭 점프 (Tenant Management)
- **간편 테넌트 등록**: S/4HANA Cloud의 6자리 테넌트 번호(예: `my400000`)와 시스템 별칭, 환경 구분(DEV, TEST, PROD 등)을 쉽게 보관할 수 있습니다.
- **원클릭 Launchpad 이동**: 등록된 시스템별로 Fiori Launchpad 홈 화면으로 즉시 이동합니다.
- **-api 개발 전용 엔드포인트 복사**: S/4HANA Cloud OData 및 프록시 바인딩을 위한 전용 `-api` 주소(`https://my400000-api.s4hana.cloud.sap/...`)를 클립보드에 원클릭으로 복사합니다.

### ⚡ 2. 강력한 Fiori UI5 자동화 매크로 (Fiori Automation)
- **사용자 정의 카탈로그 확장 (Custom Catalog Extension) 자동화**:
  - `ui5-deploy.yaml`에 배포된 애플리케이션 명칭(예: `ZUMRCO0030`)을 입력하면, 자동으로 IAM App ID 규격(`YY1_ZUMRCO0030_UI5R`)으로 완성하여 해당 유지보수 페이지로 다이렉트 이동합니다.
  - 검색창에 원하는 역할 ID(예: `SAP_CORE_BC_EXT_CBO,SAP_CORE_BC_EXT_UI` 등 쉼표 구분)를 입력하여 순차적 개별 검색 및 다중 선택을 오동작(엔터 시 창 꺼짐) 없이 강제 돋보기 클릭 방식으로 안전하게 등록합니다.
  - 역할 추가 완료 후, 메인 테이블 전체 선택 및 최종 **'게시 (Publish)'** 와 2차 확인 MessageBox까지 일괄적으로 자동 승인하고 새로고침하여 갱신합니다.
- **비즈니스 역할 유지보수 (Maintain Business Roles) 자동화**:
  - 역할 ID 및 내역(Description)을 입력하고 실행 시, 신규 역할 생성 -> 역할 카탈로그 연동 -> 쓰기 액세스 권한 무제한(Unrestricted) 설정 -> 비즈니스 사용자 매핑 다이얼로그 팝업 노출까지의 모든 지루한 과정을 1초 만에 자동 수행합니다.

### 📌 3. 커스텀 Fiori 앱 바로가기 (App Shortcuts Grid)
- **타일 레이아웃 조작**: 자주 사용하는 Fiori 표준 앱(비즈니스 역할 유지보수, 사용자 정의 CDS 뷰, ABAP 런타임 오류, 뷰 브라우저 등)을 세련된 2열 타일 레이아웃으로 빠르게 접속합니다.
- **타일 직접 클릭 앤 점프**: 별도의 이동 단추 없이 타일 자체를 클릭해 활성 탭 주소를 변경하거나 신규 탭으로 대상 테넌트 주소에 맞게 이동합니다.

### 🍪 4. 원클릭 SAP 세션/쿠키 일괄 초기화
- 테넌트 환경 전환이나 세션 꼬임 시, 세션 타임아웃을 기다리지 않고 해당 도메인(`.s4hana.cloud.sap`, `.sap.com`, `.oncnd.sap` 등)과 연동된 쿠키를 일괄적으로 삭제하여 브라우저 새로고침 즉시 깨끗한 세션 상태로 진입하도록 지원합니다.

### 🪪 5. 접속 계정 정보 바로보기
- Fiori Launchpad 상단 시스템 정보 바에 현재 로그인한 사용자 이름과 이메일을 함께 표시하여, 여러 테넌트를 오갈 때 지금 어느 계정으로 접속해 있는지 한눈에 확인할 수 있습니다.
- 정보 바 옆에 추가되는 ⓘ 아이콘을 클릭하면 SAP 표준 프로필 메뉴의 '정보(About)' 다이얼로그가 별도 클릭 없이 바로 열립니다.

---

## 📸 스크린샷 (Screenshots)

| 🏢 테넌트 등록 및 이동 | ⚡ Fiori UI5 자동화 매크로 | 📌 주요 Fiori 앱 바로가기 타일 |
|:---:|:---:|:---:|
| ![테넌트 등록 및 이동](images/image%201.png) | ![Fiori UI5 자동화](images/image%202.png) | ![바로가기 타일](images/image%203.png) |

**🪪 접속 계정 정보 바로보기** (예시 화면, 실제 계정 정보는 모자이크 처리)

![접속 계정 정보 바로보기](images/image%206.png)

---

## 💻 설치 및 실행 방법 (Installation)

### 개발자 모드로 로컬 설치 (Load Unpacked)
1. [GitHub Releases](https://github.com/dongqdev/sap-public-cloud-helper/releases)에서 최신 `sap-public-cloud-helper.zip` 압축 파일을 다운로드하여 해제합니다. (또는 git clone)
   ```bash
   git clone https://github.com/dongqdev/sap-public-cloud-helper.git
   ```
2. Chrome 브라우저를 열고 `chrome://extensions/` 주소로 이동합니다.
3. 우측 상단의 **`개발자 모드`** 토글 스위치를 활성화합니다.
4. 좌측 상단의 **`압축해제된 확장 프로그램을 로드합니다`** 버튼을 클릭합니다.
5. 압축을 해제한 프로젝트 폴더(`sap-public-cloud-helper`)를 선택하여 설치를 완료합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Platform**: Chrome Extension Manifest V3
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Sleek Dark Theme, CSS Grid Layout), JavaScript (ES6+)
- **API Integration**: Chrome Extension Storage API (`chrome.storage.sync` 영구 동기화), Scripting API (`chrome.scripting.executeScript`), Cookies API (`chrome.cookies.remove`)
- **Automation Architecture**: DOM Query Selector & XPath, Event Dispatcher Pipeline, Local Busy Detection (BusyIndicator polling)

---

## 📄 라이선스 (License)

This project is licensed under the MIT License.
