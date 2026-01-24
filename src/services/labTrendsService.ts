/**
 * Lab Trends Service for Vinesight
 * Calculates trends and statistics for soil and petiole tests
 */

import { SoilTestRecord, PetioleTestRecord } from '../types/database';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../hooks/useLabTests';
import { TrendData, ParameterTrend, TestTrendsResponse } from '../types/analytics';

export class LabTrendsService {
  static calculateSoilTrends(tests: SoilTestRecord[]): TestTrendsResponse {
    console.log('calculateSoilTrends called with', tests.length, 'tests');
    return this.calculateTrends(tests, SOIL_PARAMETERS);
  }

  static calculatePetioleTrends(tests: PetioleTestRecord[]): TestTrendsResponse {
    console.log('calculatePetioleTrends called with', tests.length, 'tests');
    return this.calculateTrends(tests, PETIOLE_PARAMETERS);
  }

  private static calculateTrends<T extends SoilTestRecord | PetioleTestRecord>(
    tests: T[],
    paramDefinitions: Array<{ key: string; label: string; unit: string }>,
  ): TestTrendsResponse {
    const trendData: TrendData[] = [...tests]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((test) => ({
        date: test.date,
        parameters: test.parameters,
      }));

    const parameterTrends: Record<string, ParameterTrend> = {};

    paramDefinitions.forEach((param) => {
      const values = trendData
        .map((t) => t.parameters?.[param.key])
        .filter((v): v is number => v !== null && v !== undefined);

      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const change =
          values.length > 1
            ? values[0] !== 0
              ? ((values[values.length - 1] - values[0]) / values[0]) * 100
              : null // baseline zero -> cannot calculate percentage, return null
            : 0;

        parameterTrends[param.key] = {
          key: param.key,
          label: param.label,
          unit: param.unit,
          values,
          min,
          max,
          avg,
          change,
        };
      }
    });

    const dateRange =
      trendData.length > 0
        ? { start: trendData[0].date, end: trendData[trendData.length - 1].date }
        : { start: '', end: '' };

    return { tests: trendData, parameterTrends, dateRange };
  }
}
