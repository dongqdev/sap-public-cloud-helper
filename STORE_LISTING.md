# Chrome 웹 스토어 등록 자료 (초안)

`chrome.google.com/webstore/devconsole`에 제출할 때 그대로 붙여넣을 수 있도록 준비한 자료입니다.
실제 계정 등록($5 1회 결제)과 제출·심사는 직접 진행해야 합니다.

## 카테고리

**Developer Tools**

## 짧은 설명 (Short description, 132자 이내)

```
SAP S/4HANA Cloud 테넌트 관리·Fiori 카탈로그 자동화·쿠키 일괄 삭제를 지원하는 비공식 개발자 도구
```

## 상세 설명 (Detailed description)

```
SAP Public Cloud Helper는 SAP S/4HANA Cloud (Public Edition) 환경에서 반복되는 관리 작업을
자동화하는 비공식(Unofficial) 크롬 확장 프로그램입니다. SAP SE와 제휴 관계가 없습니다.

주요 기능
- 멀티 테넌트 원클릭 이동: DEV/TEST/PROD 테넌트 번호와 별칭을 저장하고 Launchpad로 바로 이동,
  -api OData 엔드포인트 클립보드 복사
- 카탈로그 확장 게시 매크로: IAM 앱 ID 매핑, 비즈니스 카탈로그 역할 다중 등록, 게시(Publish)
  확인까지 자동 처리
- 주요 앱 바로가기: 자주 쓰는 Fiori 표준 관리 앱 타일 모음
- 세션 쿠키 원클릭 리셋: 테넌트 전환 시 관련 도메인 쿠키만 선택적으로 삭제

개인정보
이 확장 프로그램은 자체 서버를 운영하지 않으며 어떠한 데이터도 외부로 전송하지 않습니다.
저장한 테넌트 정보는 Chrome 계정의 동기화 저장소(storage.sync)에만 남습니다.
자세한 내용: https://dongqdev.github.io/sap-public-cloud-helper/privacy.html

소스 코드: https://github.com/dongqdev/sap-public-cloud-helper
```

## 단일 목적 설명 (Single purpose, 심사 폼 필수 항목)

```
SAP S/4HANA Cloud (Public Edition) 테넌트를 다루는 개발자/컨설턴트를 위해, 테넌트 이동과
Fiori 카탈로그 게시 같은 반복적인 관리 작업을 자동화하는 것이 유일한 목적입니다.
```

## 권한 사용 근거 (심사 폼에 권한별로 입력)

| 권한 | 근거 |
|---|---|
| `storage` | 사용자가 등록한 테넌트 목록과 앱 바로가기를 저장합니다. |
| `activeTab` | 확장 아이콘/컨텍스트 메뉴 클릭 시 현재 탭에서 자동화 스크립트를 실행합니다. |
| `scripting` | Fiori 카탈로그 게시 자동화 콘텐츠 스크립트를 대상 탭에 동적으로 주입합니다. |
| `tabs` | 등록된 테넌트로 새 탭을 열거나 현재 탭 주소를 변경합니다. |
| `clipboardWrite` | 테넌트의 `-api` OData 엔드포인트 주소를 클립보드에 복사합니다. |
| `contextMenus` | 마우스 우클릭 메뉴로 자주 쓰는 SAP 관리 화면 바로가기를 제공합니다. |
| `cookies` | 테넌트 전환 시 세션 쿠키를 일괄 삭제합니다 (지정된 SAP 도메인에만 적용). |
| `host_permissions` (`*.s4hana.cloud.sap`, `*.oncnd.sap`, `*.sap.com`, `*.ondemand.com`) | 위 자동화 스크립트 주입과 쿠키 삭제 기능의 대상 도메인을 SAP 관련 사이트로 한정합니다. 그 외 사이트는 접근하지 않습니다. |

## 스크린샷

Chrome 웹 스토어 요구 규격은 1280×800(또는 640×400)입니다.

- `images/image 4.png`, `images/image 5.png` — 이미 1280×800, 그대로 사용 가능
- `images/image 1~3.png` — 팝업 UI만 담긴 세로 이미지(380×520~574)라 규격 미달. 스토어용으로
  더 쓰려면 새로 캡처하거나 1280×800 배경 위에 합성이 필요합니다 (최소 1장만 있으면 제출 가능하므로
  필수는 아님).

## 제출 전 확인할 위험 요소

- **이름에 "SAP" 포함**: Chrome 웹 스토어 정책상 타사 상표를 확장 이름에 쓰면 소유권/제휴 오인을
  이유로 반려될 수 있습니다. 상세 설명에 "비공식(Unofficial), SAP SE와 무관"을 명시했지만,
  이름 자체(`SAP Public Cloud Helper`)는 심사에서 걸릴 가능성이 있습니다. 이름을 유지할지,
  `S/4HANA Tenant Helper`처럼 SAP를 빼고 설명문에서만 언급할지는 결정이 필요합니다.
- **넓은 host_permissions**: `*.sap.com`, `*.ondemand.com`은 실제 사용 범위(쿠키 삭제)에 비해
  넓어 보일 수 있습니다. 심사에서 범위 축소를 요구하면 위 표의 근거를 그대로 제출하면 됩니다.
- **개인정보처리방침 URL**: GitHub Pages를 쓴다면 `https://dongqdev.github.io/sap-public-cloud-helper/privacy.html`
  형태가 됩니다. 실제 Pages 배포 도메인과 일치하는지 제출 전 확인하세요.
