# Dark Mode Implementation Examples (Revised)

Practical code examples for implementing dark mode using only Zustand (no Context).

---

## 1. Complete Theme Store

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
      
      setMode: (mode: ThemeMode) => {
        set({ mode });
      },
      
      setSystemMode: (systemMode: 'light' | 'dark') => {
        set({ systemMode });
      },
      
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
        // Called on app startup for any additional setup
      },
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Selector hooks for convenience (no need to call isDark() every time)
export const useIsDark = () => useThemeStore((state) => state.isDark());
export const useThemeMode = () => useThemeStore((state) => state.mode);
export const useToggleTheme = () => useThemeStore((state) => state.toggle);
```

---

## 2. Root Layout - FOUC Prevention

### app/_layout.tsx (Complete)
```typescript
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore, initAuthListener, cleanupAuthListener } from '@/stores/auth-store';
import { useThemeStore, useIsDark } from '@/stores/theme-store';
import { ErrorBoundary } from '@/components/error-boundary';

// Configure font scaling
Text.defaultProps = {
  ...(Text.defaultProps ?? {}),
  allowFontScaling: true,
};
TextInput.defaultProps = {
  ...(TextInput.defaultProps ?? {}),
  allowFontScaling: true,
};

// Sentry setup
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
try {
  Sentry.init({
    dsn: sentryDsn,
    enabled: !__DEV__ && Boolean(sentryDsn),
    debug: __DEV__,
    tracesSampleRate: 1.0,
    integrations: [Sentry.reactNativeTracingIntegration()],
  });
} catch (error) {
  if (__DEV__) {
    console.error('Sentry initialization failed:', error);
  }
}

SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ============================================================================
// Inner Component - Uses Theme (Zustand only, no Context)
// ============================================================================

function RootContent() {
  const isDark = useIsDark();
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    const init = async () => {
      await initialize();
      initAuthListener();
    };
    init();

    return () => {
      cleanupAuthListener();
    };
  }, [initialize]);

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync().catch(() => null);
    }
  }, [isLoading]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {/* StatusBar reacts immediately to theme changes */}
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="add-activity" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add-entry" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add-task" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add-worker" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add-soil-profile" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add-stock" options={{ presentation: 'modal' }} />
              <Stack.Screen
                name="add-warehouse-item"
                options={{ presentation: 'modal', headerShown: false }}
              />
              <Stack.Screen name="add-lab-test" options={{ presentation: 'modal' }} />
              <Stack.Screen name="water-level" options={{ presentation: 'modal' }} />
              <Stack.Screen name="log-entry/add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="log-entry/edit/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="edit-activity/[id]" options={{ presentation: 'modal' }} />
            </Stack>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// ============================================================================
// Root Component - Waits for Zustand Hydration
// ============================================================================

function RootLayout() {
  const systemMode = useColorScheme();
  const setSystemMode = useThemeStore((state) => state.setSystemMode);
  const [isThemeReady, setIsThemeReady] = useState(false);

  // Update system mode when it changes
  useEffect(() => {
    if (systemMode) {
      setSystemMode(systemMode as 'light' | 'dark');
    }
  }, [systemMode, setSystemMode]);

  // Wait for Zustand to hydrate from AsyncStorage BEFORE rendering
  useEffect(() => {
    useThemeStore.persist.rehydrate().then(() => {
      setIsThemeReady(true);
    });
  }, []);

  // Don't render anything until theme is loaded (prevents FOUC)
  if (!isThemeReady) {
    return null;
  }

  return <RootContent />;
}

export default Sentry.wrap(RootLayout);
```

**Key points:**
- `RootLayout` waits for `useThemeStore.persist.rehydrate()` to complete
- Returns `null` until theme is loaded (prevents FOUC)
- `RootContent` uses theme via `useIsDark()` selector
- `StatusBar` updates immediately when theme changes
- System mode synced via `useColorScheme()`

---

## 3. Complete Color System

### src/styles/theme.ts (Production Ready)
```typescript
/**
 * VineSight Design System - Light & Dark Themes
 * Type-safe, single source of truth for all colors
 */

// ============================================================================
// SEMANTIC COLORS - Light & Dark Variants
// ============================================================================

export const semanticColors = {
  light: {
    // Backgrounds
    background: '#ffffff',
    backgroundSecondary: '#f9fafb',
    backgroundTertiary: '#f3f4f6',
    
    // Text / Foreground
    foreground: '#111827',
    foregroundSecondary: '#4b5563',
    foregroundTertiary: '#9ca3af',
    foregroundDisabled: '#d1d5db',
    
    // Components
    card: '#ffffff',
    cardSecondary: '#f9fafb',
    input: '#f2f2f7',
    inputBorder: '#e5e7eb',
    inputBorderFocused: '#408059',
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
    
    // Text / Foreground
    foreground: '#f9fafb',
    foregroundSecondary: '#d1d5db',
    foregroundTertiary: '#9ca3af',
    foregroundDisabled: '#6b7280',
    
    // Components
    card: '#1f2937',
    cardSecondary: '#374151',
    input: '#374151',
    inputBorder: '#4b5563',
    inputBorderFocused: '#75b397',
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

// ============================================================================
// ACTIVITY TYPE COLORS
// ============================================================================

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

// ============================================================================
// WATER STATUS COLORS
// ============================================================================

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

// ============================================================================
// BRAND COLORS
// ============================================================================

export const brandColors = {
  primary: {
    light: '#408059',
    dark: '#5cb85c',
  },
  secondary: {
    light: '#346a4a',
    dark: '#408059',
  },
} as const;

// ============================================================================
// SHADOWS - Critical for dark mode depth perception
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
      shadowOpacity: 0.3,  // Much stronger in dark mode
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
// LAYOUT & TYPOGRAPHY (Same for both themes)
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
// TYPE-SAFE HELPER FUNCTIONS
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
  level: keyof typeof shadows.light,
  isDark: boolean
) {
  return isDark ? shadows.dark[level] : shadows.light[level];
}

export function getPrimaryColor(isDark: boolean): string {
  return isDark ? brandColors.primary.dark : brandColors.primary.light;
}

// ============================================================================
// EXPORT EVERYTHING
// ============================================================================

export const theme = {
  semanticColors,
  activityColors,
  waterColors,
  brandColors,
  shadows,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  getSemanticColor,
  getActivityColor,
  getWaterColor,
  getShadow,
  getPrimaryColor,
} as const;

export default theme;
```

---

## 4. Component Pattern Examples

### src/components/ui/button.tsx
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
  getPrimaryColor,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
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
  const primaryColor = getPrimaryColor(isDark);

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: isDisabled
        ? getSemanticColor('foregroundDisabled', isDark)
        : primaryColor,
    },
    secondary: {
      backgroundColor: getSemanticColor('card', isDark),
      borderWidth: 1,
      borderColor: getSemanticColor('border', isDark),
    },
    outline: {
      borderWidth: 1,
      borderColor: isDisabled ? getSemanticColor('border', isDark) : primaryColor,
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
      color: primaryColor,
      fontWeight: fontWeight.semibold,
    },
    outline: {
      color: isDisabled ? getSemanticColor('foregroundDisabled', isDark) : primaryColor,
      fontWeight: fontWeight.semibold,
    },
    ghost: {
      color: primaryColor,
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
          color={variant === 'primary' ? '#fff' : primaryColor}
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

### src/components/ui/input.tsx
```typescript
import React from 'react';
import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { useIsDark } from '@/stores/theme-store';
import {
  getSemanticColor,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@/styles/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
}

export function Input({
  label,
  error,
  required,
  placeholderTextColor,
  ...props
}: InputProps) {
  const isDark = useIsDark();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={{ marginBottom: spacing[4] }}>
      {label && (
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: getSemanticColor('foreground', isDark),
            marginBottom: spacing[2],
          }}
        >
          {label}
          {required && <Text style={{ color: getSemanticColor('error', isDark) }}> *</Text>}
        </Text>
      )}

      <TextInput
        placeholderTextColor={placeholderTextColor || getSemanticColor('foregroundTertiary', isDark)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          backgroundColor: getSemanticColor('input', isDark),
          borderWidth: 1,
          borderColor: error
            ? getSemanticColor('error', isDark)
            : isFocused
              ? getSemanticColor('inputBorderFocused', isDark)
              : getSemanticColor('inputBorder', isDark),
          borderRadius: borderRadius.lg,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          fontSize: fontSize.base,
          color: getSemanticColor('foreground', isDark),
        }}
        {...props}
      />

      {error && (
        <Text
          style={{
            fontSize: fontSize.sm,
            color: getSemanticColor('error', isDark),
            marginTop: spacing[2],
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
```

---

## 5. Using Theme in Screens

### Example: Farm Detail Screen ([id].tsx)
```typescript
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useIsDark } from '@/stores/theme-store';
import {
  getSemanticColor,
  getWaterColor,
  spacing,
  fontSize,
  fontWeight,
} from '@/styles/theme';
import { Card } from '@/components/ui/card';

export default function FarmDetailScreen() {
  const isDark = useIsDark();

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: getSemanticColor('background', isDark),
      }}
      contentContainerStyle={{
        padding: spacing[4],
      }}
    >
      {/* Header */}
      <Text
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: getSemanticColor('foreground', isDark),
          marginBottom: spacing[6],
        }}
      >
        Farm Name
      </Text>

      {/* Water Status Card */}
      <Card variant="elevated">
        <View
          style={{
            padding: spacing[3],
            backgroundColor: getWaterColor('good', isDark),
            borderRadius: 8,
          }}
        >
          <Text
            style={{
              color: getSemanticColor('card', isDark),
              fontWeight: fontWeight.semibold,
            }}
          >
            Water Level: Good
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}
```

---

## 6. Settings Screen - Theme Selector

```typescript
// app/(tabs)/settings.tsx - Add this section
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useThemeStore } from '@/stores/theme-store';
import { getSemanticColor, spacing, fontSize, fontWeight } from '@/styles/theme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function SettingsScreen() {
  const isDark = useThemeStore((state) => state.isDark());
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: getSemanticColor('background', isDark),
      }}
      contentContainerStyle={{
        padding: spacing[4],
      }}
    >
      {/* Appearance Section */}
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: getSemanticColor('foreground', isDark),
          marginBottom: spacing[4],
        }}
      >
        Appearance
      </Text>

      <Card variant="outlined">
        <View style={{ gap: spacing[3] }}>
          <Button
            title={`${mode === 'light' ? '✓ ' : ''}Light Mode`}
            variant={mode === 'light' ? 'primary' : 'secondary'}
            onPress={() => setMode('light')}
          />
          <Button
            title={`${mode === 'dark' ? '✓ ' : ''}Dark Mode`}
            variant={mode === 'dark' ? 'primary' : 'secondary'}
            onPress={() => setMode('dark')}
          />
          <Button
            title={`${mode === 'system' ? '✓ ' : ''}System (Default)`}
            variant={mode === 'system' ? 'primary' : 'secondary'}
            onPress={() => setMode('system')}
          />
        </View>
      </Card>

      <Text
        style={{
          fontSize: fontSize.sm,
          color: getSemanticColor('foregroundTertiary', isDark),
          marginTop: spacing[3],
          textAlign: 'center',
        }}
      >
        Currently using {isDark ? 'Dark' : 'Light'} theme
      </Text>
    </ScrollView>
  );
}
```

---

## 7. Usage in Existing Farm Detail Screen

You have `/app/farm/[id].tsx`. Here's how to add theme colors:

```typescript
// Add at top
import { useIsDark } from '@/stores/theme-store';
import { getSemanticColor, spacing } from '@/styles/theme';

// Inside component
export default function FarmDetailScreen() {
  const isDark = useIsDark();
  
  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: getSemanticColor('background', isDark),
      }}
    >
      {/* Rest of your screen... */}
    </ScrollView>
  );
}
```

That's it. No Context, no redundancy. Just Zustand + helper functions.

---

## Summary

✅ **Single Zustand store** - no Context  
✅ **FOUC prevented** - theme loads before rendering  
✅ **Type-safe colors** - helper functions prevent bugs  
✅ **Easy to use** - `useIsDark()` selector in any component  
✅ **Persistent** - theme preference saved automatically  
✅ **System detection** - respects OS theme preference  
✅ **Production ready** - all edge cases handled
