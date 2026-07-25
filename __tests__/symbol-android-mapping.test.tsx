import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Symbol } from '@/components/ui/symbol';

const glyphMap = MaterialCommunityIcons.glyphMap as Record<string, number>;
const ionGlyphMap = Ionicons.glyphMap as Record<string, number>;

describe('Android settings icon mappings', () => {
  it.each(['office-building', 'view-dashboard-outline'])(
    '%s is available in MaterialCommunityIcons',
    (icon) => {
      expect(glyphMap[icon]).toBeDefined();
    },
  );
});

describe('Symbol Android resolution (regression: invisible "minus" icon)', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    // Force the Android/web (vector-icon) resolution path in Symbol. jest-expo
    // defaults Platform.OS to 'ios', which renders via expo-symbols and hides
    // missing-glyph mappings — the root cause of the "minus" icon being
    // invisible only on Android.
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = originalOS;
  });

  it('renders "minus" as a real icon on Android, not the • placeholder', () => {
    const { toJSON } = render(<Symbol name="minus" size={20} />);
    const serialized = JSON.stringify(toJSON());
    // The bug: bare "minus" resolved to no glyph and fell through to the
    // placeholder, which renders a "•" Text node. The fix routes it to a real
    // Ionicon glyph ("remove") instead.
    expect(serialized).not.toContain('•');
  });

  it('maps "minus" to a glyph that exists in the Ionicons font', () => {
    // The Symbol resolution chain for bare "minus" on Android lands on
    // SYMBOL_TO_IONICON["minus"] -> "remove". That glyph must exist.
    expect(ionGlyphMap['remove']).toBeDefined();
  });

  it('renders the theme icon "circle.lefthalf.filled" as a real icon on Android, not the • placeholder', () => {
    // Regression: the Theme settings row icon was unmapped and fell through to
    // the "•" placeholder (visible as a dot). It now maps to MaterialCommunityIcons
    // "theme-light-dark".
    const { toJSON } = render(<Symbol name="circle.lefthalf.filled" size={20} />);
    const serialized = JSON.stringify(toJSON());
    expect(serialized).not.toContain('•');
  });

  it('maps "circle.lefthalf.filled" to "theme-light-dark" which exists in MaterialCommunityIcons', () => {
    expect(glyphMap['theme-light-dark']).toBeDefined();
  });

  // Regression batch: SF Symbol names used in real JSX that previously fell
  // through to the "•" placeholder on Android. Each must now resolve to a glyph.
  it.each([
    ['circle.lefthalf.filled'], // Theme settings row
    ['plus.circle'], // fertilizer-plan-card add button
    ['minus.circle'], // warehouse-item-form quantity decrement
    ['note.text'], // note-form header icon
  ])('renders "%s" as a real icon on Android, not the • placeholder', (name) => {
    const { toJSON } = render(<Symbol name={name} size={20} />);
    expect(JSON.stringify(toJSON())).not.toContain('•');
  });
});
