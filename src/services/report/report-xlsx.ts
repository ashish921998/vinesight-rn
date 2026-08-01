import { strToU8, zipSync } from 'fflate';
import { formatDate } from '@/i18n/format';
import type { ReportData } from '@/types/report';
import { FPC_SIMPLE_HEADERS, buildFpcSimpleRows, fpcSimpleRowCells } from './report-fpc-simple';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXPORTER_ROWS_PER_PAGE = 72;
const EXPORTER_HEADERS = FPC_SIMPLE_HEADERS.map((header) =>
  header === 'Qty Per Liter' ? 'Qty Per Liter ' : header,
);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function inlineCell(row: number, column: number, value: string, style: number): string {
  const reference = `${columnName(column)}${row}`;
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function toBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const triple = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += alphabet[(triple >> 18) & 63];
    output += alphabet[(triple >> 12) & 63];
    output += second == null ? '=' : alphabet[(triple >> 6) & 63];
    output += third == null ? '=' : alphabet[triple & 63];
  }
  return output;
}

function buildSheetXml(data: ReportData): string {
  const rows: string[] = [];
  const mergeCells: string[] = [];
  const rowBreaks: number[] = [];
  const addMergedIdentityRow = (row: number, label: string, style: number) => {
    rows.push(`<row r="${row}">${inlineCell(row, 0, label, style)}</row>`);
    mergeCells.push(`<mergeCell ref="A${row}:H${row}"/>`);
  };
  const addIdentityBlock = (startRow: number) => {
    addMergedIdentityRow(startRow, `Farmer Name: ${data.farmName}`, 1);
    addMergedIdentityRow(startRow + 1, `Variety: ${data.farmVariety ?? '-'}`, 2);
    addMergedIdentityRow(
      startRow + 2,
      `Pruning Date: ${data.pruningDate ? formatDate(data.pruningDate) : '-'}`,
      3,
    );
    rows.push(
      `<row r="${startRow + 3}">${EXPORTER_HEADERS.map((header, index) =>
        inlineCell(startRow + 3, index, header, 4),
      ).join('')}</row>`,
    );
  };

  let rowNumber = 1;
  buildFpcSimpleRows(data.fpcActivity ?? []).forEach((row, index) => {
    if (index % EXPORTER_ROWS_PER_PAGE === 0) {
      if (index > 0) rowBreaks.push(rowNumber - 1);
      addIdentityBlock(rowNumber);
      rowNumber += 4;
    }
    const values = fpcSimpleRowCells(row);
    rows.push(
      `<row r="${rowNumber}">${values
        .map((value, column) =>
          inlineCell(rowNumber, column, value, column >= 3 && column <= 5 ? 6 : 5),
        )
        .join('')}</row>`,
    );
    rowNumber += 1;
  });

  if (rows.length === 0) addIdentityBlock(1);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="9" customWidth="1"/>
    <col min="2" max="2" width="9" customWidth="1"/>
    <col min="3" max="3" width="9.109375" customWidth="1"/>
    <col min="4" max="4" width="11.88671875" customWidth="1"/>
    <col min="5" max="5" width="38.109375" customWidth="1"/>
    <col min="6" max="6" width="12.88671875" customWidth="1"/>
    <col min="7" max="7" width="10" customWidth="1"/>
    <col min="8" max="8" width="14.6640625" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="${mergeCells.length}">${mergeCells.join('')}</mergeCells>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
  ${
    rowBreaks.length > 0
      ? `<rowBreaks count="${rowBreaks.length}" manualBreakCount="${rowBreaks.length}">${rowBreaks
          .map((row) => `<brk id="${row}" min="0" max="16383" man="1"/>`)
          .join('')}</rowBreaks>`
      : ''
  }
</worksheet>`;
}

export function generateFpcWorkbook(data: ReportData): string {
  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Activity Register" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    ),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBCB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`),
    'xl/worksheets/sheet1.xml': strToU8(buildSheetXml(data)),
  };

  return toBase64(zipSync(files, { level: 6 }));
}
