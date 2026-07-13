import type { ReportFormat, ReportType } from '@/types/report';

export function getDefaultReportFormat(reportType: ReportType): ReportFormat {
  return reportType === 'fpc-activity' ? 'csv' : 'pdf';
}
