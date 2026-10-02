import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReportExportActions } from '@/components/screens/reports/report-export-actions';
import { getDefaultReportFormat } from '@/components/screens/reports/report-format';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      primary: '#285e3d',
      onPrimary: '#ffffff',
      onSurface: '#17231c',
      onSurfaceVariant: '#647168',
      outline: '#7d9182',
      outlineVariant: '#cbd5cc',
      surface: '#ffffff',
      surfaceVariant: '#f5f8f5',
    },
    surface: {
      s100: '#ffffff',
      s200: '#eee7dd',
      s300: '#cbd5cc',
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

describe('Exporter report controls', () => {
  it('uses XLSX for the exporter register and PDF for the report', () => {
    expect(getDefaultReportFormat('fpc-activity')).toBe('xlsx');
    expect(getDefaultReportFormat('comprehensive')).toBe('pdf');
  });

  it('keeps the exporter workbook separate from the farmer report actions', () => {
    const onShare = jest.fn();
    const onSave = jest.fn();
    const onShareExporter = jest.fn();
    const props = {
      canExport: true,
      isExporting: false,
      exportFormat: 'csv' as const,
      onSelectFormat: jest.fn(),
      onShare,
      onDownload: onSave,
      onShareExporter,
      panelStyle: {},
    };
    const { getByText, queryByText, rerender } = render(<ReportExportActions {...props} />);

    fireEvent.press(getByText('reports.share'));
    fireEvent.press(getByText('reports.saveToFiles'));
    fireEvent.press(getByText('reports.fpc.shareXlsx'));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onShareExporter).toHaveBeenCalledTimes(1);
    expect(getByText('reports.fpc.audience')).toBeTruthy();
    expect(getByText('reports.fpc.exportTitle')).toBeTruthy();

    rerender(<ReportExportActions {...props} isExporting />);
    expect(queryByText('reports.fpc.shareXlsx')).toBeNull();
  });

  it('switches export format from the action bar', () => {
    const onSelectFormat = jest.fn();
    const { getByText } = render(
      <ReportExportActions
        canExport
        isExporting={false}
        exportFormat="csv"
        onSelectFormat={onSelectFormat}
        onShare={jest.fn()}
        onDownload={jest.fn()}
        panelStyle={{}}
      />,
    );

    fireEvent.press(getByText('PDF'));
    expect(onSelectFormat).toHaveBeenCalledWith('pdf');
  });
});
