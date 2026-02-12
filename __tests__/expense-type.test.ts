import { mapExpenseRecordTypeToTypeId, mapExpenseTypeIdToRecordType } from '@/utils/expense-type';

describe('expense type mapping', () => {
  it('maps form expense types to backend expense types', () => {
    expect(mapExpenseTypeIdToRecordType('Equipment')).toBe('equipment');
    expect(mapExpenseTypeIdToRecordType('Fuel')).toBe('fuel');
    expect(mapExpenseTypeIdToRecordType('Seeds/Plants')).toBe('materials');
    expect(mapExpenseTypeIdToRecordType('Packaging')).toBe('materials');
    expect(mapExpenseTypeIdToRecordType('Transport')).toBe('materials');
    expect(mapExpenseTypeIdToRecordType('Maintenance')).toBe('equipment');
    expect(mapExpenseTypeIdToRecordType('Other')).toBe('other');
  });

  it('maps backend and voice labels to form expense types', () => {
    expect(mapExpenseRecordTypeToTypeId('equipment')).toBe('Equipment');
    expect(mapExpenseRecordTypeToTypeId('fuel')).toBe('Fuel');
    expect(mapExpenseRecordTypeToTypeId('materials')).toBe('Seeds/Plants');
    expect(mapExpenseRecordTypeToTypeId('labor')).toBe('Other');
    expect(mapExpenseRecordTypeToTypeId('other')).toBe('Other');
    expect(mapExpenseRecordTypeToTypeId('Seeds/Plants')).toBe('Seeds/Plants');
    expect(mapExpenseRecordTypeToTypeId('Transport')).toBe('Transport');
    expect(mapExpenseRecordTypeToTypeId('Maintenance')).toBe('Maintenance');
  });

  it('returns fallback for unknown values', () => {
    expect(mapExpenseRecordTypeToTypeId('unexpected')).toBe('');
    expect(mapExpenseRecordTypeToTypeId('unexpected', 'Other')).toBe('Other');
    expect(mapExpenseRecordTypeToTypeId(null, 'Other')).toBe('Other');
  });
});
