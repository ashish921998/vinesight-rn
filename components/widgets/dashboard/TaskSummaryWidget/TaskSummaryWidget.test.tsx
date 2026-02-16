import React from 'react';
import { render } from '@widgets/shared/utils/testUtils';
import { TaskSummaryWidget } from './TaskSummaryWidget';

describe('TaskSummaryWidget', () => {
  it('renders header title', () => {
    const { getByTestId } = render(<TaskSummaryWidget />);
    expect(getByTestId('task-summary-widget-title')).toBeTruthy();
  });

  it('renders total task count badge', () => {
    const { getByTestId } = render(<TaskSummaryWidget />);
    expect(getByTestId('task-summary-widget-total-badge')).toBeTruthy();
  });

  it('renders overdue badge when tasks are overdue', () => {
    const { getByTestId } = render(<TaskSummaryWidget />);
    expect(getByTestId('task-summary-widget-overdue-badge')).toBeTruthy();
  });

  it('renders task rows with test IDs', () => {
    const { getByTestId } = render(<TaskSummaryWidget />);
    expect(getByTestId('task-1')).toBeTruthy();
    expect(getByTestId('task-1-name')).toBeTruthy();
    expect(getByTestId('task-1-due')).toBeTruthy();
    expect(getByTestId('task-2')).toBeTruthy();
    expect(getByTestId('task-3')).toBeTruthy();
    expect(getByTestId('task-4')).toBeTruthy();
  });

  it('applies custom testID and accessibilityLabel', () => {
    const { getByLabelText, getByTestId } = render(
      <TaskSummaryWidget testID="custom-test" accessibilityLabel="custom label" />,
    );
    expect(getByLabelText('custom label')).toBeTruthy();
    expect(getByTestId('custom-test-title')).toBeTruthy();
  });

  it('renders status pills with test IDs', () => {
    const { getByTestId, getAllByTestId } = render(<TaskSummaryWidget />);
    expect(getByTestId('status-pill-overdue')).toBeTruthy();
    expect(getByTestId('status-pill-due')).toBeTruthy();
    expect(getAllByTestId('status-pill-upcoming')).toHaveLength(2);
  });
});
