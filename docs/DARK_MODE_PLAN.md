# Dark Mode Implementation Plan - VineSight RN (Revised)

## Core Principles
- **Single source of truth**: Zustand only (no Context redundancy)
- **No FOUC**: Load theme before rendering app
- **Type-safe**: Strong TypeScript inference for colors
- **Minimal risk**: Phased component migration with testing

---

## 1. Theme Store (Zustand)

The foundation. This replaces both Context and separate storage logic.

### src/stores/theme-store.ts
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStoreState {
  mode: ThemeMode;
  systemMode: 'light' | 'dark' | null;
  
  // Actions
  setMode: (mode: ThemeMode) => void;
  setSystemMode: (mode: 'light' | 'dark') => void;
  toggle: () => void;
  initialize: () => Promise<void>;
  
  // Computed
  isDark: () => boolean;
}

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      systemMode: null,
      
      setMode: (mode: ThemeMode) => set({ mode }),
      
      setSystemMode: (systemMode: 'light' | 'dark') => set({ systemMode }),
      
      toggle: () => {
        const { mode } = get();
        const nextMode: ThemeMode = 
          mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
        set({ mode: nextMode });
      },
      
      isDark: () => {
        const { mode, systemMode } = get();
        if (mode === 'system') {
          return systemMode === 'dark';
        }
        return mode === 'dark';
      },
      
      initialize: async () => {
        // Already initialized by persist middleware
        // This is called on app startup for any async cleanup
      },
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Hydrate immediately on app start
      onRehydrateStorage: () => {
        return (state) => {
          // Sync with system after hydration
          if (state?.mode === 'system') {
            // This happens in RootLayout
          }
        };
      },
    }
  )
);

// Export selector hooks for convenience
export const useIsDark = () => useThemeStore((state) => state.isDark());
export const useThemeMode = () => useThemeStore((state) => state.mode);
```

---

## 2. Preventing FOUC (Critical)

The key issue: theme loads from AsyncStorage asynchronously. You must load it BEFORE rendering any UI.

### Root Layout: Block Rendering Until Theme Loads

```typescript
// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore, useIsDark } from '@/stores/theme-store';
import { ErrorBoundary } from '@/components/error-boundary';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 1 },
  },
});

// Inner component that uses theme
function RootContent() {
  const isDark = useIsDark();
  const authInitialize = useAuthStore((state) => state.initialize);
  const authIsLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    (async () => {
      await authInitialize();
    })();
  }, [authInitialize]);

  useEffect(() => {
    if (!authIsLoading) {
      SplashScreen.hideAsync();
    }
  }, [authIsLoading]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {/* StatusBar reacts to theme change immediately */}
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// Root component: waits for Zustand hydration
function RootLayout() {
  const systemMode = useColorScheme();
  const themeMode = useThemeStore((state) => state.mode);
  const setSystemMode = useThemeStore((state) => state.setSystemMode);
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    // Update system mode when it changes
    if (systemMode) {
      setSystemMode(systemMode as 'light' | 'dark');
    }
  }, [systemMode, setSystemMode]);

  // Wait for Zustand to hydrate from AsyncStorage
  useEffect(() => {
    useThemeStore.persist.rehydrate().then(() => {
      setIsThemeReady(true);
    });
  }, []);

  // Don't render anything until theme is loaded
  if (!isThemeReady) {
    return null;
  }

  return <RootContent />;
}

export default RootLayout;
```

This ensures:
- ✅ Theme loads from AsyncStorage BEFORE splash screen hides
- ✅ No flash of wrong theme
- ✅ System mode detected and synced
- ✅ StatusBar updates immediately

---

## 3. Type-Safe Color System

### src/styles/theme.ts (Complete Rewrite)

```typescript
/**
 * VineSight Design System - Light & Dark Themes
 * Single source of truth for all colors
 */

// ============================================================================
// BASE COLORS
// ============================================================================

export const semanticColors = {
  light: {
    // Backgrounds
    background: '#ffffff',
    backgroundSecondary: '#f9fafb',
    backgroundTertiary: '#f3f4f6',
    
    // Text
    foreground: '#111827',
    foregroundSecondary: '#4b5563',
    foregroundTertiary: '#9ca3af',
    foregroundDisabled: '#d1d5db',
    
    // Components
    card: '#ffffff',
    cardSecondary: '#f9fafb',
    input: '#f2f2f7',
    inputBorder: '#e5e7eb',
    border: '#e5e7eb',
    divider: '#e5e7eb',
    overlay: 'rgba(0, 0, 0, 0.5)',
    
    // Status
    success: '#34c759',
    warning: '#ff9500',
    error: '#ff3b30',
    info: '#0a84ff',
  },
  dark: {
    // Backgrounds
    background: '#111827',
    backgroundSecondary: '#1f2937',
    backgroundTertiary: '#374151',
    
    // Text
    foreground: '#f9fafb',
    foregroundSecondary: '#d1d5db',
    foregroundTertiary: '#9ca3af',
    foregroundDisabled: '#6b7280',
    
    // Components
    card: '#1f2937',
    cardSecondary: '#374151',
    input: '#374151',
    inputBorder: '#4b5563',
    border: '#374151',
    divider: '#1f2937',
    overlay: 'rgba(0, 0, 0, 0.7)',
    
    // Status (brighter for contrast)
    success: '#32d74b',
    warning: '#ff9500',
    error: '#ff453a',
    info: '#0a84ff',
  },
} as const;

// Activity type colors: light/dark variants
export const activityColors = {
  light: {
    irrigation: '#4d8573',
    spray: '#598d6b',
    fertigation: '#408059',
    harvest: '#669475',
    observation: '#738c7a',
    task: '#4d8573',
    expense: '#598066',
  },
  dark: {
    irrigation: '#5aa892',
    spray: '#6ba97d',
    fertigation: '#5cb85c',
    harvest: '#7aad89',
    observation: '#7fa085',
    task: '#5aa892',
    expense: '#66a870',
  },
} as const;

// Water status colors: adjusted for both themes
export const waterColors = {
  light: {
    critical: '#db4437',
    low: '#ea8600',
    medium: '#f9a825',
    good: '#0b8d32',
  },
  dark: {
    critical: '#ff453a',
    low: '#ff9500',
    medium: '#ffc20e',
    good: '#34c759',
  },
} as const;

// Primary brand colors
export const primaryColors = {
  light: '#408059',
  dark: '#5cb85c',
} as const;

// Secondary brand colors
export const secondaryColors = {
  light: '#346a4a',
  dark: '#408059',
} as const;

// ============================================================================
// SHADOWS - Important for dark mode depth perception
// ============================================================================

export const shadows = {
  light: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  dark: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,      // Stronger in dark mode
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 5,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
      elevation: 8,
    },
  },
} as const;

// ============================================================================
// SPACING, RADIUS, TYPOGRAPHY (Same for both themes)
// ============================================================================

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

// ============================================================================
// HELPER FUNCTION - Type-safe color access
// ============================================================================

export function getSemanticColor(
  key: keyof typeof semanticColors.light,
  isDark: boolean
): string {
  return isDark ? semanticColors.dark[key] : semanticColors.light[key];
}

export function getActivityColor(
  activity: keyof typeof activityColors.light,
  isDark: boolean
): string {
  return isDark ? activityColors.dark[activity] : activityColors.light[activity];
}

export function getWaterColor(
  level: keyof typeof waterColors.light,
  isDark: boolean
): string {
  return isDark ? waterColors.dark[level] : waterColors.light[level];
}

export function getShadow(
  level: keyof (typeof shadows.light),
  isDark: boolean
): typeof shadows.light.sm {
  return isDark ? shadows.dark[level] : shadows.light[level];
}

// ============================================================================
// THEME OBJECT (for convenience)
// ============================================================================

export const theme = {
  semanticColors,
  activityColors,
  waterColors,
  primaryColors,
  secondaryColors,
  shadows,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  getSemanticColor,
  getActivityColor,
  getWaterColor,
  getShadow,
} as const;

export default theme;
```

---

## 4. Updated Components (New Pattern)

### src/components/ui/button.tsx (Updated)
```typescript
import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useIsDark } from '@/stores/theme-store';
import {
  getSemanticColor,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  getShadow,
} from '@/styles/theme';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDark = useIsDark();
  const isDisabled = disabled || isLoading;

  // Variant styles - now type-safe
  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: isDisabled
        ? getSemanticColor('foregroundDisabled', isDark)
        : '#408059', // primary[500]
    },
    secondary: {
      backgroundColor: getSemanticColor('card', isDark),
      borderWidth: 1,
      borderColor: getSemanticColor('border', isDark),
    },
    outline: {
      borderWidth: 1,
      borderColor: isDisabled ? getSemanticColor('border', isDark) : '#408059',
      backgroundColor: 'transparent',
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const textVariantStyles: Record<string, TextStyle> = {
    primary: {
      color: isDisabled ? getSemanticColor('foregroundDisabled', isDark) : '#fff',
      fontWeight: fontWeight.semibold,
    },
    secondary: {
      color: '#408059',
      fontWeight: fontWeight.semibold,
    },
    outline: {
      color: isDisabled ? getSemanticColor('foregroundDisabled', isDark) : '#408059',
      fontWeight: fontWeight.semibold,
    },
    ghost: {
      color: '#408059',
      fontWeight: fontWeight.medium,
    },
  };

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
    md: { paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
    lg: { paddingHorizontal: spacing[8], paddingVertical: spacing[4] },
  };

  const textSizeStyles: Record<string, TextStyle> = {
    sm: { fontSize: fontSize.sm },
    md: { fontSize: fontSize.base },
    lg: { fontSize: fontSize.lg },
  };

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(fullWidth ? { width: '100%' } : {}),
  };

  const textStyle: TextStyle = {
    ...textSizeStyles[size],
    ...textVariantStyles[variant],
  };

  const resolvedStyle: PressableProps['style'] = (state) => [
    containerStyle,
    typeof style === 'function' ? style(state) : style,
  ];

  return (
    <Pressable disabled={isDisabled} style={resolvedStyle} {...props}>
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fff' : '#408059'}
          size="small"
        />
      ) : (
        <>
          {leftIcon && <View style={{ marginRight: spacing[2] }}>{leftIcon}</View>}
          <Text style={textStyle}>{title}</Text>
          {rightIcon && <View style={{ marginLeft: spacing[2] }}>{rightIcon}</View>}
        </>
      )}
    </Pressable>
  );
}
```

### src/components/ui/card.tsx
```typescript
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useIsDark } from '@/stores/theme-store';
import {
  getSemanticColor,
  getShadow,
  spacing,
  borderRadius,
} from '@/styles/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'elevated' | 'filled' | 'outlined';
}

export function Card({ children, style, variant = 'elevated' }: CardProps) {
  const isDark = useIsDark();

  const variantStyles: Record<string, ViewStyle> = {
    elevated: {
      backgroundColor: getSemanticColor('card', isDark),
      borderRadius: borderRadius.lg,
      ...getShadow('md', isDark),
    },
    filled: {
      backgroundColor: getSemanticColor('cardSecondary', isDark),
      borderRadius: borderRadius.lg,
    },
    outlined: {
      backgroundColor: getSemanticColor('card', isDark),
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: getSemanticColor('border', isDark),
    },
  };

  return (
    <View
      style={[
        variantStyles[variant],
        { padding: spacing[4] },
        style,
      ]}
    >
      {children}
    </View>
  );
}
```

---

## 5. Component Migration Strategy (Phased, Low Risk)

### Phase 1: Foundation (Days 1-2)
- [x] Create theme-store.ts with Zustand
- [x] Update theme.ts with semantic colors + helpers
- [x] Update _layout.tsx to prevent FOUC
- [x] Update Button component (most used)
- [x] Test on device: light/dark/system modes

### Phase 2: Core UI Components (Days 3-4)
- [ ] Card
- [ ] Input
- [ ] List item
- [ ] Badge/Chip
- [ ] Modal/Overlay

### Phase 3: Screen Migrations (Days 5-7)
- [ ] Dashboard screen
- [ ] Farms screen
- [ ] Farm detail screen ([id].tsx)
- [ ] Workers screen
- [ ] Settings screen (add theme selector)

### Phase 4: Polish (Days 8-9)
- [ ] Tab bar styling
- [ ] Navigation header styling
- [ ] Image/photo overlays
- [ ] Modal backdrop opacity
- [ ] Test all transitions

### Phase 5: Testing & Launch (Days 10-11)
- [ ] Accessibility audit (contrast ratios)
- [ ] Device testing (iPhone 12-15, Android 12-14)
- [ ] Theme switching during app use
- [ ] System preference detection

---

## 6. Settings Screen (Theme Selector)

```typescript
// app/(tabs)/settings.tsx - Addition
import { useThemeStore } from '@/stores/theme-store';
import { getSemanticColor } from '@/styles/theme';

export function ThemeSelector() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const isDark = useThemeStore((state) => state.isDark());

  return (
    <Card>
      <Button
        title={`${mode === 'light' ? '✓ ' : ''}Light`}
        variant={mode === 'light' ? 'primary' : 'secondary'}
        onPress={() => setMode('light')}
      />
      <Button
        title={`${mode === 'dark' ? '✓ ' : ''}Dark`}
        variant={mode === 'dark' ? 'primary' : 'secondary'}
        onPress={() => setMode('dark')}
      />
      <Button
        title={`${mode === 'system' ? '✓ ' : ''}System`}
        variant={mode === 'system' ? 'primary' : 'secondary'}
        onPress={() => setMode('system')}
      />
    </Card>
  );
}
```

---

## 7. Known Issues to Watch

1. **WebView components** - May ignore parent theme. Need manual color props.
2. **Image overlays** - Add semi-transparent overlay on dark mode.
3. **Modal backdrop** - Use `getSemanticColor('overlay', isDark)`.
4. **Text in images** - Ensure contrast on both themes.
5. **Google Maps** - May need dark style config (if used).

---

## 8. Testing Checklist

- [ ] App launches without FOUC
- [ ] Light mode looks correct
- [ ] Dark mode looks correct
- [ ] System mode auto-detects correctly
- [ ] Switching themes updates all UI immediately
- [ ] Preference persists after restart
- [ ] StatusBar updates with theme
- [ ] All 50+ screens render correctly
- [ ] Contrast ratios meet WCAG AA (4.5:1 for normal text)
- [ ] No console errors or warnings

---

## Timeline
- **Phase 1**: 2 days
- **Phase 2**: 2 days
- **Phase 3**: 3 days
- **Phase 4**: 2 days
- **Phase 5**: 2 days
- **Total**: ~11 days (flexible, 2-3 weeks depending on scope)

---

## Why This Plan Is Better

✅ **No FOUC** - Theme loads before rendering  
✅ **Single store** - Only Zustand, no Context redundancy  
✅ **Type-safe** - Helper functions prevent string-key bugs  
✅ **Dark mode shadows** - Proper depth perception values  
✅ **Phased rollout** - Low risk, testable at each step  
✅ **Clear component pattern** - Easy to replicate across 50+ components  
✅ **Settings integration** - Built-in theme selector  
✅ **Production ready** - Handles edge cases (WebView, overlays, etc.)
