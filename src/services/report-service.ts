/**
 * Report Service for Vinesight
 * Handles report generation for CSV and PDF exports
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { ReportData, ReportSummary, ReportPreview, DateRange, ReportType } from '../types/report';
import { formatDate, formatCurrency } from '@/i18n/format';
import {
  Farm,
  IrrigationRecord,
  SprayRecord,
  FertigationRecord,
  HarvestRecord,
  ExpenseRecord,
} from '../types/database';

export class ReportService {
  /**
   * Filter records by date range
   */
  static filterByDateRange<T extends { date: string }>(records: T[], dateRange: DateRange): T[] {
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999); // Include entire end day

    return records.filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate >= fromDate && recordDate <= toDate;
    });
  }

  /**
   * Generate report data from farm records
   */
  static generateReportData(
    farm: Farm,
    irrigations: IrrigationRecord[],
    sprays: SprayRecord[],
    fertigations: FertigationRecord[],
    harvests: HarvestRecord[],
    expenses: ExpenseRecord[],
    dateRange: DateRange,
  ): ReportData {
    return {
      farmName: farm.name,
      farmArea: farm.area,
      farmRegion: farm.region,
      dateRange,
      irrigation: this.filterByDateRange(irrigations, dateRange).map((r) => ({
        date: r.date,
        duration: r.duration,
        area: r.area,
        growthStage: r.growth_stage,
        moistureStatus: r.moisture_status,
        systemDischarge: r.system_discharge,
        notes: r.notes || undefined,
      })),
      spray: this.filterByDateRange(sprays, dateRange).map((r) => ({
        date: r.date,
        chemical: r.chemical,
        dose: r.dose,
        area: r.area,
        weather: r.weather,
        operator: r.operator,
        notes: r.notes || undefined,
      })),
      fertigation: this.filterByDateRange(fertigations, dateRange).map((r) => ({
        date: r.date,
        fertilizers: r.fertilizers
          ? r.fertilizers.map((f) => `${f.name} (${f.quantity} ${f.unit})`).join(', ')
          : 'N/A',
        area: r.area,
        notes: r.notes || undefined,
      })),
      harvest: this.filterByDateRange(harvests, dateRange).map((r) => ({
        date: r.date,
        quantity: r.quantity,
        grade: r.grade,
        price: r.price || undefined,
        buyer: r.buyer || undefined,
        notes: r.notes || undefined,
      })),
      expense: this.filterByDateRange(expenses, dateRange).map((r) => ({
        date: r.date,
        type: r.type,
        cost: r.cost,
        remarks: r.remarks || undefined,
      })),
    };
  }

  /**
   * Calculate report summary statistics
   */
  static calculateSummary(data: ReportData): ReportSummary {
    const totalIrrigationHours = data.irrigation.reduce((sum, r) => sum + r.duration, 0);
    const totalWaterUsage = data.irrigation.reduce(
      (sum, r) => sum + r.duration * r.systemDischarge,
      0,
    );
    const totalHarvest = data.harvest.reduce((sum, r) => sum + r.quantity, 0);
    const totalRevenue = data.harvest.reduce((sum, r) => sum + r.quantity * (r.price || 0), 0);
    const totalExpenses = data.expense.reduce((sum, r) => sum + r.cost, 0);

    return {
      totalRecords:
        data.irrigation.length +
        data.spray.length +
        data.fertigation.length +
        data.harvest.length +
        data.expense.length,
      dateRange: `${data.dateRange.from} to ${data.dateRange.to}`,
      totalIrrigationHours: Math.round(totalIrrigationHours * 10) / 10,
      totalWaterUsage: Math.round(totalWaterUsage),
      totalHarvest: Math.round(totalHarvest * 10) / 10,
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      netProfit: Math.round(totalRevenue - totalExpenses),
      irrigationCount: data.irrigation.length,
      sprayCount: data.spray.length,
      fertigationCount: data.fertigation.length,
      harvestCount: data.harvest.length,
      expenseCount: data.expense.length,
    };
  }

  /**
   * Generate report preview
   */
  static generatePreview(
    farm: Farm,
    irrigations: IrrigationRecord[],
    sprays: SprayRecord[],
    fertigations: FertigationRecord[],
    harvests: HarvestRecord[],
    expenses: ExpenseRecord[],
    dateRange: DateRange,
  ): ReportPreview {
    const data = this.generateReportData(
      farm,
      irrigations,
      sprays,
      fertigations,
      harvests,
      expenses,
      dateRange,
    );
    const summary = this.calculateSummary(data);
    return { data, summary };
  }

  /**
   * Generate CSV content from report data
   */
  static generateCSV(data: ReportData, reportType: ReportType): string {
    const rows: string[] = [];

    // Header
    rows.push(`Farm Report - ${data.farmName}`);
    rows.push(`Region: ${data.farmRegion}`);
    rows.push(`Area: ${data.farmArea} acres`);
    rows.push(`Date Range: ${data.dateRange.from} to ${data.dateRange.to}`);
    rows.push(
      `Generated: ${formatDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' })}`,
    );
    rows.push('');

    if (reportType === 'operations' || reportType === 'comprehensive') {
      // Irrigation
      if (data.irrigation.length > 0) {
        rows.push('IRRIGATION RECORDS');
        rows.push(
          'Date,Duration (hrs),Area,Growth Stage,Moisture Status,System Discharge (L/h),Notes',
        );
        data.irrigation.forEach((r) => {
          rows.push(
            `${r.date},${r.duration},${r.area},${r.growthStage},${r.moistureStatus},${r.systemDischarge},"${r.notes || ''}"`,
          );
        });
        rows.push('');
      }

      // Spray
      if (data.spray.length > 0) {
        rows.push('SPRAY RECORDS');
        rows.push('Date,Chemical,Dose,Area,Weather,Operator,Notes');
        data.spray.forEach((r) => {
          rows.push(
            `${r.date},"${r.chemical}","${r.dose}",${r.area},"${r.weather}","${r.operator}","${r.notes || ''}"`,
          );
        });
        rows.push('');
      }

      // Fertigation
      if (data.fertigation.length > 0) {
        rows.push('FERTIGATION RECORDS');
        rows.push('Date,Fertilizers,Area,Notes');
        data.fertigation.forEach((r) => {
          rows.push(`${r.date},"${r.fertilizers}",${r.area},"${r.notes || ''}"`);
        });
        rows.push('');
      }

      // Harvest
      if (data.harvest.length > 0) {
        rows.push('HARVEST RECORDS');
        rows.push('Date,Quantity (kg),Grade,Price,Buyer,Notes');
        data.harvest.forEach((r) => {
          rows.push(
            `${r.date},${r.quantity},"${r.grade}",${r.price || ''},"${r.buyer || ''}","${r.notes || ''}"`,
          );
        });
        rows.push('');
      }
    }

    if (reportType === 'financial' || reportType === 'comprehensive') {
      // Expenses
      if (data.expense.length > 0) {
        rows.push('EXPENSE RECORDS');
        rows.push('Date,Type,Cost,Remarks');
        data.expense.forEach((r) => {
          rows.push(`${r.date},"${r.type}",${r.cost},"${r.remarks || ''}"`);
        });
        rows.push('');
      }
    }

    return rows.join('\n');
  }

  /**
   * Generate PDF HTML content
   */
  static generatePDFHtml(
    data: ReportData,
    summary: ReportSummary,
    reportType: ReportType,
    preferredCurrency: string = 'INR',
  ): string {
    const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { color: #1a5d1a; margin-bottom: 10px; }
        h2 { color: #333; margin-top: 25px; border-bottom: 2px solid #1a5d1a; padding-bottom: 5px; }
        .header { margin-bottom: 20px; }
        .meta { color: #666; font-size: 14px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .summary-item { padding: 10px; background: white; border-radius: 4px; }
        .summary-value { font-size: 20px; font-weight: bold; color: #1a5d1a; }
        .summary-label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background: #1a5d1a; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .profit { color: #16a34a; }
        .loss { color: #dc2626; }
        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
      </style>
    `;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>${styles}</head>
      <body>
        <div class="header">
          <h1>🍇 ${data.farmName}</h1>
          <p class="meta">
            Region: ${data.farmRegion} | Area: ${data.farmArea} acres<br>
            Report Period: ${data.dateRange.from} to ${data.dateRange.to}
          </p>
        </div>
        
        <div class="summary">
          <h3 style="margin-top: 0;">Summary</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">${summary.totalRecords}</div>
              <div class="summary-label">Total Records</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${summary.totalHarvest} kg</div>
              <div class="summary-label">Total Harvest</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${formatCurrency(summary.totalRevenue, preferredCurrency, { minimumFractionDigits: 0 })}</div>
              <div class="summary-label">Revenue</div>
            </div>
            <div class="summary-item">
              <div class="summary-value ${summary.netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(summary.netProfit, preferredCurrency, { minimumFractionDigits: 0 })}</div>
              <div class="summary-label">Net Profit</div>
            </div>
          </div>
        </div>
    `;

    if (reportType === 'operations' || reportType === 'comprehensive') {
      if (data.irrigation.length > 0) {
        html += `
          <h2>💧 Irrigation Records (${data.irrigation.length})</h2>
          <table>
            <tr><th>Date</th><th>Duration</th><th>Area</th><th>Growth Stage</th><th>Discharge</th></tr>
            ${data.irrigation
              .slice(0, 20)
              .map(
                (r) =>
                  `<tr><td>${r.date}</td><td>${r.duration}h</td><td>${r.area}</td><td>${r.growthStage}</td><td>${r.systemDischarge} L/h</td></tr>`,
              )
              .join('')}
          </table>
          ${data.irrigation.length > 20 ? `<p>... and ${data.irrigation.length - 20} more records</p>` : ''}
        `;
      }

      if (data.spray.length > 0) {
        html += `
          <h2>🧪 Spray Records (${data.spray.length})</h2>
          <table>
            <tr><th>Date</th><th>Chemical</th><th>Dose</th><th>Area</th><th>Weather</th></tr>
            ${data.spray
              .slice(0, 20)
              .map(
                (r) =>
                  `<tr><td>${r.date}</td><td>${r.chemical}</td><td>${r.dose}</td><td>${r.area}</td><td>${r.weather}</td></tr>`,
              )
              .join('')}
          </table>
        `;
      }

      if (data.harvest.length > 0) {
        html += `
          <h2>🍇 Harvest Records (${data.harvest.length})</h2>
          <table>
            <tr><th>Date</th><th>Quantity</th><th>Grade</th><th>Price</th><th>Buyer</th></tr>
            ${data.harvest
              .slice(0, 20)
              .map(
                (r) =>
                  `<tr><td>${r.date}</td><td>${r.quantity} kg</td><td>${r.grade}</td><td>${r.price ? formatCurrency(r.price, preferredCurrency, { minimumFractionDigits: 0 }) : '-'}</td><td>${r.buyer || '-'}</td></tr>`,
              )
              .join('')}
          </table>
        `;
      }
    }

    if (reportType === 'financial' || reportType === 'comprehensive') {
      if (data.expense.length > 0) {
        html += `
          <h2>💰 Expense Records (${data.expense.length})</h2>
          <table>
            <tr><th>Date</th><th>Type</th><th>Cost</th><th>Remarks</th></tr>
            ${data.expense
              .slice(0, 20)
              .map(
                (r) =>
                  `<tr><td>${r.date}</td><td>${r.type}</td><td>${formatCurrency(r.cost, preferredCurrency, { minimumFractionDigits: 0 })}</td><td>${r.remarks || '-'}</td></tr>`,
              )
              .join('')}
          </table>
        `;
      }
    }

    html += `
        <div class="footer">
          Generated by Vinesight on ${formatDate(new Date(), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Export report as CSV file
   */
  static async exportCSV(data: ReportData, reportType: ReportType): Promise<void> {
    const csv = this.generateCSV(data, reportType);
    const filename = `${data.farmName.replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.csv`;

    const file = new File(Paths.cache, filename);
    const writer = file.writableStream().getWriter();
    const bytes = new TextEncoder().encode(csv);
    await writer.write(bytes);
    await writer.close();
    const fileUri =
      (file as { uri?: string }).uri ?? (file as { path?: string }).path ?? file.toString();

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Report',
        UTI: 'public.comma-separated-values-text',
      });
    }
  }

  /**
   * Export report as PDF file
   */
  static async exportPDF(
    data: ReportData,
    summary: ReportSummary,
    reportType: ReportType,
    preferredCurrency: string = 'INR',
  ): Promise<void> {
    const html = this.generatePDFHtml(data, summary, reportType, preferredCurrency);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Report',
        UTI: 'com.adobe.pdf',
      });
    }
  }
}
