/**
 * Lab Trends Service for Vinesight
 * Calculates trends and statistics for soil and petiole tests
 */

import { SoilTestRecord, PetioleTestRecord } from '../types/database';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../constants/lab-test-parameters';
import { TrendData, ParameterTrend, TestTrendsResponse } from '../types/analytics';

export class LabTrendsService {
  static calculateSoilTrends(tests: SoilTestRecord[]): TestTrendsResponse {
    console.log('calculateSoilTrends called with', tests.length, 'tests');
    return this.calculateTrends(tests, SOIL_PARAMETERS, LabTrendsService.mapSoilParameters);
  }

  static calculatePetioleTrends(tests: PetioleTestRecord[]): TestTrendsResponse {
    console.log('calculatePetioleTrends called with', tests.length, 'tests');
    return this.calculateTrends(tests, PETIOLE_PARAMETERS, LabTrendsService.mapPetioleParameters);
  }

  private static mapSoilParameters(parameters: Record<string, number>): Record<string, number> {
    const keyMap: Record<string, string> = {
      pH: 'ph',
      EC: 'ec',
      OC: 'organicCarbon',
      OM: 'organicMatter',
      N: 'nitrogen',
      P: 'phosphorus',
      K: 'potassium',
      Ca: 'calcium',
      Mg: 'magnesium',
      S: 'sulfur',
      Fe: 'iron',
      Mn: 'manganese',
      Zn: 'zinc',
      Cu: 'copper',
      B: 'boron',
    };

    const mapped: Record<string, number> = {};
    for (const [key, value] of Object.entries(parameters)) {
      const newKey = keyMap[key] || key;
      mapped[newKey] = value;
    }
    return mapped;
  }

  private static mapPetioleParameters(parameters: Record<string, number>): Record<string, number> {
    const keyMap: Record<string, string> = {
      N: 'total_nitrogen',
      P: 'phosphorus',
      K: 'potassium',
      Ca: 'calcium',
      Mg: 'magnesium',
      S: 'sulfur',
      Fe: 'iron',
      Mn: 'manganese',
      Zn: 'zinc',
      Cu: 'copper',
      B: 'boron',
      Mo: 'molybdenum',
      Na: 'sodium',
      Cl: 'chloride',
      ammonical_nitrogen: 'ammoniacal_nitrogen',
    };

    const mapped: Record<string, number> = {};
    for (const [key, value] of Object.entries(parameters)) {
      const newKey = keyMap[key] || key;
      mapped[newKey] = value;
    }
    return mapped;
  }

  private static calculateTrends<T extends SoilTestRecord | PetioleTestRecord>(
    tests: T[],
    paramDefinitions: Array<{
      key: string;
      label: string;
      shortLabel: string;
      unit: string;
      optimalMin: number;
      optimalMax: number;
    }>,
    parameterMapper?: (params: Record<string, number>) => Record<string, number>,
  ): TestTrendsResponse {
    const trendData: TrendData[] = [...tests]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((test) => ({
        date: test.date,
        dateOfPruning: test.date_of_pruning ?? null,
        parameters: parameterMapper ? parameterMapper(test.parameters) : test.parameters,
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
          shortLabel: param.shortLabel,
          unit: param.unit,
          optimalMin: param.optimalMin,
          optimalMax: param.optimalMax,
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
