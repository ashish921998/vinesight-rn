import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReportFpcColumnToggles } from '@/components/screens/reports/report-fpc-column-toggles';
import { ReportExportActions } from '@/components/screens/reports/report-export-actions';
import { getDefaultReportFormat } from '@/components/screens/reports/report-format';
import { FPC_FULL_COLUMNS, FPC_LEAN_COLUMNS } from '@/types/report';

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
  it('uses CSV for exporter reports and PDF for other report types', () => {
    expect(getDefaultReportFormat('fpc-activity')).toBe('xlsx');
    expect(getDefaultReportFormat('comprehensive')).toBe('pdf');
    expect(getDefaultReportFormat('operations')).toBe('pdf');
    expect(getDefaultReportFormat('financial')).toBe('pdf');
    expect(getDefaultReportFormat('stock-usage')).toBe('pdf');
  });

  it('switches between simple and detailed report presets', () => {
    const onChange = jest.fn();
    const { getByText, rerender } = render(
      <ReportFpcColumnToggles columns={FPC_LEAN_COLUMNS} onChange={onChange} />,
    );

    fireEvent.press(getByText('reports.fpc.detail.detailed.title'));
    expect(onChange).toHaveBeenCalledWith(FPC_FULL_COLUMNS);

    rerender(<ReportFpcColumnToggles columns={FPC_FULL_COLUMNS} onChange={onChange} />);
    fireEvent.press(getByText('reports.fpc.detail.simple.title'));
    expect(onChange).toHaveBeenLastCalledWith(FPC_LEAN_COLUMNS);
  });

  // Replaces an earlier case for the `isExporterReport` prop, which swapped
  // every label in the bar. The buyer's register now exports from its own
  // disclosure section, so the bar only ever describes the report — and its two
  // actions are named for their outcome rather than their file format.
  it('names its actions by outcome, not by mechanism', () => {
    const onShare = jest.fn();
    const onSave = jest.fn();
    const { getByText } = render(
      <ReportExportActions
        canExport
        isExporting={false}
        exportFormat="csv"
        onSelectFormat={jest.fn()}
        onShare={onShare}
        onDownload={onSave}
        panelStyle={{}}
      />,
    );

    fireEvent.press(getByText('reports.share'));
    fireEvent.press(getByText('reports.saveToFiles'));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
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
