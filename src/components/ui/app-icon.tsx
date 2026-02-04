import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { useM3 } from '@/styles/use-theme';

type BaseIconName =
  | 'plus-circle'
  | 'x-circle'
  | 'x'
  | 'chevron-down'
  | 'chevron-right'
  | 'calendar'
  | 'save'
  | 'trash'
  | 'check-circle'
  | 'alert-circle'
  | 'document'
  | 'leaf'
  | 'drop'
  | 'flask'
  | 'basket'
  | 'cash'
  | 'flash'
  | 'time'
  | 'layers'
  | 'chart';

type AppIconName = BaseIconName | string;

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
}

const ICON_ALIASES: Record<string, BaseIconName> = {
  'add-circle': 'plus-circle',
  'close-circle': 'x-circle',
  close: 'x',
  'chevron-down': 'chevron-down',
  'chevron-forward': 'chevron-right',
  calendar: 'calendar',
  save: 'save',
  'trash-outline': 'trash',
  'checkmark-circle': 'check-circle',
  'alert-circle-outline': 'alert-circle',
  'document-text': 'document',
  'water-outline': 'drop',
  water: 'drop',
  'checkbox-outline': 'check-circle',
  flask: 'flask',
  basket: 'basket',
  cash: 'cash',
  leaf: 'leaf',
  flash: 'flash',
  'time-outline': 'time',
  layers: 'layers',
  analytics: 'chart',
};

export function AppIcon({ name, size = 20, color }: AppIconProps) {
  const m3 = useM3();
  const resolvedColor = color ?? m3.colorScheme.onSurface;
  const resolvedName = ICON_ALIASES[name] ?? (name as BaseIconName);
  const strokeWidth = 1.8;

  switch (resolvedName) {
    case 'plus-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Line x1="12" y1="8" x2="12" y2="16" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Line x1="8" y1="12" x2="16" y2="12" stroke={resolvedColor} strokeWidth={strokeWidth} />
        </Svg>
      );
    case 'x-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Line
            x1="8.5"
            y1="8.5"
            x2="15.5"
            y2="15.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
          />
          <Line
            x1="15.5"
            y1="8.5"
            x2="8.5"
            y2="15.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1="6" y1="6" x2="18" y2="18" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Line x1="18" y1="6" x2="6" y2="18" stroke={resolvedColor} strokeWidth={strokeWidth} />
        </Svg>
      );
    case 'chevron-down':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M6 9l6 6 6-6"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'chevron-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M9 6l6 6-6 6"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect
            x="4"
            y="6"
            width="16"
            height="14"
            rx="2"
            ry="2"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Line x1="8" y1="4" x2="8" y2="8" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Line x1="16" y1="4" x2="16" y2="8" stroke={resolvedColor} strokeWidth={strokeWidth} />
        </Svg>
      );
    case 'save':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="2"
            ry="2"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Rect x="8" y="5.5" width="8" height="4" fill={resolvedColor} />
          <Rect
            x="8"
            y="12"
            width="8"
            height="6"
            rx="1"
            ry="1"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect
            x="7"
            y="8"
            width="10"
            height="12"
            rx="1.5"
            ry="1.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Line x1="6" y1="8" x2="18" y2="8" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Line x1="10" y1="8" x2="10" y2="20" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Line x1="14" y1="8" x2="14" y2="20" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Rect x="9" y="4.5" width="6" height="2" fill={resolvedColor} />
        </Svg>
      );
    case 'check-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Path
            d="M8 12l2.5 2.5L16 9.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'alert-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Line
            x1="12"
            y1="7.5"
            x2="12"
            y2="13.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
          />
          <Circle cx="12" cy="16.5" r="1" fill={resolvedColor} />
        </Svg>
      );
    case 'document':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M7 4h7l4 4v12H7z"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinejoin="round"
          />
          <Line x1="9" y1="12" x2="16" y2="12" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Line x1="9" y1="16" x2="16" y2="16" stroke={resolvedColor} strokeWidth={strokeWidth} />
        </Svg>
      );
    case 'leaf':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M6 14c4.5-7 12-8 12-8s-1 7.5-8 12c-2.5 1.5-5.5 1-6.5 0.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Line x1="10" y1="10" x2="16" y2="16" stroke={resolvedColor} strokeWidth={strokeWidth} />
        </Svg>
      );
    case 'drop':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 4c3 4 6 7 6 10a6 6 0 1 1-12 0c0-3 3-6 6-10z"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      );
    case 'flask':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M9 4h6M10 4v5l-4.5 7a4 4 0 0 0 3.5 6h7a4 4 0 0 0 3.5-6L14 9V4"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'basket':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect
            x="5"
            y="9"
            width="14"
            height="9"
            rx="2"
            ry="2"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Path d="M8 9l4-5 4 5" stroke={resolvedColor} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      );
    case 'cash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect
            x="4"
            y="7"
            width="16"
            height="10"
            rx="2"
            ry="2"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx="12"
            cy="12"
            r="2.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      );
    case 'flash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M13 3L6 14h5l-1 7 8-12h-5l0-6z"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'time':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Line x1="12" y1="7" x2="12" y2="12" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Line x1="12" y1="12" x2="16" y2="14" stroke={resolvedColor} strokeWidth={strokeWidth} />
        </Svg>
      );
    case 'layers':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 4l8 4-8 4-8-4 8-4z"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Path d="M4 12l8 4 8-4" stroke={resolvedColor} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1="5" y1="19" x2="19" y2="19" stroke={resolvedColor} strokeWidth={strokeWidth} />
          <Rect x="6" y="12" width="3" height="7" fill={resolvedColor} />
          <Rect x="11" y="9" width="3" height="10" fill={resolvedColor} />
          <Rect x="16" y="6" width="3" height="13" fill={resolvedColor} />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      );
  }
}
