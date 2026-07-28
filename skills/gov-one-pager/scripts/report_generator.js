// SPDX-License-Identifier: Apache-2.0
// 정부 요약서형 1페이지 보고서 생성기
// 사용법: 아래 DATA 객체만 바꾼 뒤  node report_generator.js
// 사전 설치:  npm install docx
//
// 아래 DATA는 표 구조 확인용 가상 샘플이다. 사업명, 수치, 출처 모두 실제 데이터가
// 아니므로 새 주제로 재사용할 때는 DATA 객체 전체를 교체하고,
// "이하 스타일 엔진" 아래는 건드리지 않는다.

const DATA = {
  title: "「스마트 재고관리」 도입 추진계획(안)",
  rows: [
    ["사업명", [
      { line: "소매 점포 대상 수요예측 기반 발주 지원 서비스 「스마트 재고관리」", bold: true },
    ]],
    ["핵심요약", [
      { m: "◦", line: "소규모 소매 점포의 발주 판단이 담당자 경험에 의존", sup: 1 },
      { m: "◦", line: "폐기와 결품이 반복되어도 원인이 데이터로 남지 않음" },
      { m: "◦", line: "판매 데이터 기반 수요예측으로 품목별 발주량 산출" },
      { m: "◦", line: "1차 대상은 단일 점포 운영 소매점, 무료 진단 후 유료 전환" },
    ]],
    ["현황 및\n문제점", [
      { m: "-", line: "발주량 결정 기준이 문서화되지 않아 담당자별 편차 발생" },
      { m: "-", line: "폐기율과 결품률을 사후에도 측정하지 않음" },
      { m: "-", line: "기존 ERP는 도입 비용과 학습 부담이 커 소규모 점포에 부적합", sup: 1 },
      { m: "-", line: "POS에 판매 데이터가 쌓여도 분석으로 이어지지 않음" },
    ]],
    ["추진배경", [
      { m: "-", line: "인건비 상승으로 재고 관리 전담 인력 축소" },
      { m: "-", line: "POS·결제 데이터 연동 규격 확산으로 외부 분석 연계 여건 확보" },
    ]],
    ["해결방안", [
      { table: { widths: [1300, 3200, 3300], header: ["구분", "내용", "결과"], body: [
        ["수집", "POS 판매·재고 데이터 일 단위 연동", "품목별 판매 추이 확보"],
        ["예측", "요일·계절성 반영 수요예측 모델 적용", "품목별 적정 발주량 산출"],
        ["실행", "발주서 초안 자동 생성, 담당자 승인 후 확정", "발주 소요시간 단축"],
      ] } },
      { line: "안전장치 : 자동 발주 미실행, 승인 절차 필수, 개인 식별정보 미수집, 보관기간 명시", size: 15 },
    ]],
    ["제품·기능", [
      { table: { widths: [1200, 6600], header: ["단계", "내용"], body: [
        ["1단계", "POS 연동, 최근 3개월 판매 이력 수집"],
        ["2단계", "품목별 수요예측 리포트 주 1회 제공"],
        ["3단계", "발주 추천량 제시, 담당자 승인 시 발주서 생성"],
        ["4단계", "폐기·결품 실적 반영해 예측 모델 갱신"],
      ] } },
      { line: "플랫폼 : 웹 대시보드, 모바일 알림 / 기술 : 시계열 예측 모델, POS 오픈 API / 첫 사용자 : 파일럿 점포 10곳", size: 14.5 },
    ]],
    ["시장·대상", [
      { table: { widths: [1200, 3300, 3300], header: ["구분", "정의", "규모(추정)"], body: [
        ["TAM", "국내 소매 점포 관리 소프트웨어", "연 3,000억 원"],
        ["SAM", "POS 연동 가능한 중소 점포", "연 600억 원"],
        ["SOM", "3년 내 초기 확보분", "연 30억 원"],
      ] } },
      { m: "-", line: "1차 대상 : 단일 점포 운영 소매점 및 소규모 프랜차이즈 가맹점", size: 15.5 },
    ]],
    ["사업화\n방안", [
      { m: "-", label: "1단계", line: "무료 재고 진단 리포트 1회 제공" },
      { m: "-", label: "2단계", line: "유료 파일럿 3개월, 점포당 정액" },
      { m: "-", label: "3단계", line: "연간 구독, 점포당 월 정액" },
      { m: "-", line: "과금은 점포 수 기준 정액, 매출 연동 과금 미적용", size: 15.5 },
    ]],
    ["성공·중단\n기준(6M)", [
      { table: { widths: [3900, 3900], header: ["중단(Kill)", "전진(Go)"], body: [
        ["파일럿 3개월 내 유료 전환 0건", "유료 파일럿 10개 점포 확보"],
        ["예측 정확도가 기존 방식 대비 개선 없음", "결품률 20% 이상 감소"],
        ["월 이탈률 10% 초과 지속", "재계약률 70% 이상"],
      ] } },
    ]],
    ["추진일정", [
      { m: "-", label: "1개월", line: "파일럿 점포 모집, POS 연동 개발" },
      { m: "-", label: "2~3개월", line: "예측 모델 검증, 무료 진단 상품화" },
      { m: "-", label: "4~6개월", line: "유료 구독 전환, 성공·중단 기준 점검" },
    ]],
    ["참고·근거", [
      { line: "1) 출처 표기 위치 예시. 실제 사용 시 공개 통계·보고서명과 발행연도로 교체", size: 13.5 },
      { line: "2) 시장 수치는 추정치. 산출 근거와 기준연도를 함께 명시", size: 13.5 },
      { line: "3) 본 DATA는 스킬 구조 확인용 가상 샘플. 사업명·수치·출처 모두 실제 데이터 아님", size: 13.5 },
    ]],
  ],
  outfile: "보고서.docx",
};

// ====== 이하 스타일 엔진(수정 불필요) ======
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, VerticalAlign
} = require('docx');
const fs = require('fs');

const FONT = "바탕", INK = "1A1A1A";
const B = { style: BorderStyle.SINGLE, size: 4, color: "333333" };
const BH = { style: BorderStyle.SINGLE, size: 10, color: "111111" };

const tr = (txt, o = {}) => new TextRun({ text: txt, font: FONT, size: o.size || 17,
  bold: !!o.bold, color: o.color || INK });
const supRun = n => new TextRun({ text: n + ")", font: FONT, size: 11, superScript: true, color: "555555" });

function itemPara(it) {
  if (it.table) return null;
  const kids = [];
  if (it.m) kids.push(tr(it.m + " ", { size: it.size }));
  if (it.label) kids.push(tr(it.label + " ", { bold: true, size: it.size }));
  kids.push(tr(it.line, { size: it.size || 17, bold: it.bold }));
  if (it.sup) kids.push(supRun(it.sup));
  return new Paragraph({ children: kids, spacing: { after: 12, line: 234 },
    indent: { left: it.m ? 130 : 0, hanging: it.m ? 130 : 0 } });
}
function subTable(tbl) {
  const rows = [tbl.header, ...tbl.body];
  return new Table({ width: { size: tbl.widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: tbl.widths,
    borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B },
    rows: rows.map((cells, ri) => new TableRow({ tableHeader: ri === 0,
      children: cells.map((c, ci) => new TableCell({ width: { size: tbl.widths[ci], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER, margins: { top: 28, bottom: 28, left: 70, right: 70 },
        shading: ri === 0 ? { type: ShadingType.CLEAR, fill: "2C2C2C" } : undefined,
        children: [new Paragraph({ children: [tr(c, { size: 15.5, bold: ri === 0 || ci === 0,
          color: ri === 0 ? "FFFFFF" : INK })],
          alignment: (ri === 0 || ci === 0) ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 0, line: 224 } })] })) })) });
}
function contentChildren(items) {
  const out = [];
  items.forEach(it => { out.push(it.table ? subTable(it.table) : itemPara(it)); });
  return out;
}
function buildRow(label, items) {
  return new TableRow({ children: [
    new TableCell({ width: { size: 1500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      shading: { type: ShadingType.CLEAR, fill: "E7E7E4" }, margins: { top: 60, bottom: 60, left: 40, right: 40 },
      children: label.split("\n").map(s => new Paragraph({ children: [tr(s, { bold: true, size: 18 })],
        alignment: AlignmentType.CENTER, spacing: { after: 0, line: 240 } })) }),
    new TableCell({ width: { size: 8100, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 70, bottom: 70, left: 150, right: 120 }, children: contentChildren(items) }),
  ] });
}

const C = [
  new Paragraph({ children: [tr(DATA.title, { bold: true, size: 30 })],
    alignment: AlignmentType.CENTER, spacing: { after: 30 },
    border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: "111111", space: 3 } } }),
  new Paragraph({ children: [], spacing: { after: 90 } }),
  new Table({ width: { size: 9600, type: WidthType.DXA }, columnWidths: [1500, 8100],
    borders: { top: BH, bottom: BH, left: BH, right: BH, insideHorizontal: B, insideVertical: B },
    rows: DATA.rows.map(([label, items]) => buildRow(label, items)) }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 17 } } } },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 900, left: 1000, right: 1000 } } }, children: C }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(DATA.outfile, b); console.log("생성 완료:", DATA.outfile); });
