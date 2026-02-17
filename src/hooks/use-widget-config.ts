/**
 * useWidgetConfig Hook
 * Manages widget configuration state and persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { WidgetStorageService } from '@/services/widget-storage-service';
import { WidgetSyncService } from '@/services/widget-sync-service';
import type { WidgetConfig } from '@/types/widget';

interface UseWidgetConfigReturn {
  config: WidgetConfig | null;
  isLoading: boolean;
  saveConfig: (farmId: number, farmName: string) => Promise<void>;
  loadConfig: () => Promise<void>;
}

export function useWidgetConfig(): UseWidgetConfigReturn {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedConfig = await WidgetStorageService.loadConfig();
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load widget config:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (farmId: number, farmName: string) => {
    try {
      const newConfig: WidgetConfig = {
        selectedFarmId: farmId,
        selectedFarmName: farmName,
      };

      // Save to local storage
      await WidgetStorageService.saveConfig(newConfig);

      // Sync to widget
      await WidgetSyncService.saveWidgetConfig(newConfig);

      setConfig(newConfig);
    } catch (error) {
      console.error('Failed to save widget config:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    isLoading,
    saveConfig,
    loadConfig,
  };
}
