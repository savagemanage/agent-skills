// SPDX-License-Identifier: Apache-2.0
// Executive / startup English one-pager generator
// Usage: replace DATA only, then: node report_generator.js
// Requires: npm install docx
//
// Sample DATA is fictional. Replace the whole DATA object for a real topic.
// Do not edit the style engine below the marker.

const DATA = {
  title: "Smart Inventory — Pilot Proposal",
  rows: [
    ["Opportunity", [
      { line: "Demand-forecast ordering for single-store retailers", bold: true },
    ]],
    ["Summary", [
      { m: "•", line: "Ordering still rests on manager intuition", sup: 1 },
      { m: "•", line: "Waste and stockouts recur without a data trail" },
      { m: "•", line: "POS sales feed item-level order recommendations" },
      { m: "•", line: "Beachhead: independent stores; free diagnosis then paid plan" },
    ]],
    ["Problem", [
      { m: "-", line: "Order rules are undocumented, so results vary by shift" },
      { m: "-", line: "Waste and stockout rates are not measured after the fact" },
      { m: "-", line: "Full ERP is too costly and heavy for small shops", sup: 1 },
      { m: "-", line: "POS history accumulates but is never analyzed" },
    ]],
    ["Why now", [
      { m: "-", line: "Labor cost pressure shrinks dedicated inventory roles" },
      { m: "-", line: "Open POS and payments APIs make external analytics practical" },
    ]],
    ["Solution", [
      { table: { widths: [1400, 3200, 3200], header: ["Track", "What", "Outcome"], body: [
        ["Collect", "Daily POS sales and on-hand sync", "Item-level sales trend"],
        ["Forecast", "Day-of-week and seasonality model", "Suggested order quantity"],
        ["Act", "Draft PO; manager approves to send", "Shorter ordering cycle"],
      ] } },
      { line: "Guardrails: no auto-send; approval required; no PII; retention stated", size: 18 },
    ]],
    ["Product", [
      { table: { widths: [1400, 6400], header: ["Step", "What"], body: [
        ["1", "Connect POS; pull last 90 days of sales"],
        ["2", "Weekly demand report per SKU"],
        ["3", "Recommend order qty; create PO on approval"],
        ["4", "Retrain from waste and stockout outcomes"],
      ] } },
      { line: "Platform: web dashboard + mobile alerts / Stack: time-series model, POS API / First users: 10 pilot stores", size: 17 },
    ]],
    ["Market", [
      { table: { widths: [1200, 3300, 3300], header: ["Layer", "Definition", "Size (est.)"], body: [
        ["TAM", "Retail store ops software", "$2.2B / yr"],
        ["SAM", "POS-connected SMB stores", "$450M / yr"],
        ["SOM", "3-year initial capture", "$22M / yr"],
      ] } },
      { m: "-", line: "Beachhead: independent stores and small franchisees", size: 18 },
    ]],
    ["Go-to-\nmarket", [
      { m: "-", label: "1.", line: "One free inventory diagnosis report" },
      { m: "-", label: "2.", line: "Paid 3-month pilot, flat fee per store" },
      { m: "-", label: "3.", line: "Annual subscription, monthly per store" },
      { m: "-", line: "Pricing is per-store flat fee; no revenue share", size: 18 },
    ]],
    ["Kill / Go\n(6 mo)", [
      { table: { widths: [3900, 3900], header: ["Kill", "Go"], body: [
        ["Zero paid conversions in 3-month pilot", "10 paid pilot stores"],
        ["No accuracy lift vs status quo", "Stockouts down 20%+"],
        ["Monthly churn above 10%", "Renewal rate 70%+"],
      ] } },
    ]],
    ["Timeline", [
      { m: "-", label: "Mo 1", line: "Recruit pilots; ship POS connector" },
      { m: "-", label: "Mo 2–3", line: "Validate model; productize free diagnosis" },
      { m: "-", label: "Mo 4–6", line: "Convert to paid; review kill/go gates" },
    ]],
    ["Sources", [
      { line: "1) Replace with real public stats or reports and year", size: 16 },
      { line: "2) Market sizes are estimates; state method and base year", size: 16 },
      { line: "3) This DATA is a fictional structural sample only", size: 16 },
    ]],
  ],
  outfile: "one-pager.docx",
};

// ====== Style engine (do not edit) ======
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, VerticalAlign
} = require('docx');
const fs = require('fs');

const FONT = "Calibri", INK = "1A1A1A";
const B = { style: BorderStyle.SINGLE, size: 4, color: "333333" };
const BH = { style: BorderStyle.SINGLE, size: 10, color: "111111" };

const tr = (txt, o = {}) => new TextRun({ text: txt, font: FONT, size: o.size || 20,
  bold: !!o.bold, color: o.color || INK });
const supRun = n => new TextRun({ text: String(n), font: FONT, size: 12, superScript: true, color: "555555" });

function itemPara(it) {
  if (it.table) return null;
  const kids = [];
  if (it.m) kids.push(tr(it.m + " ", { size: it.size }));
  if (it.label) kids.push(tr(it.label + " ", { bold: true, size: it.size }));
  kids.push(tr(it.line, { size: it.size || 20, bold: it.bold }));
  if (it.sup) kids.push(supRun(it.sup));
  return new Paragraph({ children: kids, spacing: { after: 12, line: 240 },
    indent: { left: it.m ? 140 : 0, hanging: it.m ? 140 : 0 } });
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
        children: [new Paragraph({ children: [tr(c, { size: 18, bold: ri === 0 || ci === 0,
          color: ri === 0 ? "FFFFFF" : INK })],
          alignment: (ri === 0 || ci === 0) ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 0, line: 230 } })] })) })) });
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
      children: label.split("\n").map(s => new Paragraph({ children: [tr(s, { bold: true, size: 20 })],
        alignment: AlignmentType.CENTER, spacing: { after: 0, line: 240 } })) }),
    new TableCell({ width: { size: 8100, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 70, bottom: 70, left: 150, right: 120 }, children: contentChildren(items) }),
  ] });
}

const C = [
  new Paragraph({ children: [tr(DATA.title, { bold: true, size: 32 })],
    alignment: AlignmentType.CENTER, spacing: { after: 30 },
    border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: "111111", space: 3 } } }),
  new Paragraph({ children: [], spacing: { after: 90 } }),
  new Table({ width: { size: 9600, type: WidthType.DXA }, columnWidths: [1500, 8100],
    borders: { top: BH, bottom: BH, left: BH, right: BH, insideHorizontal: B, insideVertical: B },
    rows: DATA.rows.map(([label, items]) => buildRow(label, items)) }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 720, bottom: 720, left: 720, right: 720 },
      },
    },
    children: C,
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(DATA.outfile, b); console.log("Wrote:", DATA.outfile); });
