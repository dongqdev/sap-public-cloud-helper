// Shared default Fiori app shortcut list, used by both popup.js and options.js.
// Previously duplicated in each file and had drifted out of sync (popup had 8
// entries, options had 11), so the popup silently showed fewer apps than the
// options page's "reset to defaults" would produce.
const DEFAULT_APP_SHORTCUTS = [
  { name: '비즈니스 역할 유지보수', hash: '#BusinessUserRole-maintainNew' },
  { name: '사용자 정의 카탈로그 확장', hash: '#CustomCatalogExtension-maintain' },
  { name: '사용자 정의 CDS 뷰', hash: '#CDSView-worklist' },
  { name: 'ABAP 런타임 오류', hash: '#ABAPSystem-displayRuntimeErrors' },
  { name: '뷰 브라우저', hash: '#CDSView-browse' },
  { name: '인력 관리', hash: '#WorkforcePerson-manage_v2' },
  { name: '소프트웨어 컬렉션 엑스포트', hash: '#SoftwareCollection-export' },
  { name: '컬렉션 임포트', hash: '#SoftwareCollection-import' },
  { name: '통신규약', hash: '#CommunicationArrangement-maintain' },
  { name: '통신 시스템', hash: '#CommunicationSystem-maintain' },
  { name: '통신 사용자 유지보수', hash: '#CommunicationUser-maintain' },
];
