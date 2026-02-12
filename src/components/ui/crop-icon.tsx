import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type CropIconName =
  | 'grapes'
  | 'mango'
  | 'pomegranate'
  | 'citrus'
  | 'banana'
  | 'tomato'
  | 'sugarcane'
  | 'guava'
  | 'apple'
  | 'pear'
  | 'peach'
  | 'plum'
  | 'cherry'
  | 'strawberry'
  | 'blueberry'
  | 'raspberry'
  | 'blackberry'
  | 'papaya'
  | 'pineapple'
  | 'coconut'
  | 'arecanut'
  | 'cashew'
  | 'coffee'
  | 'tea'
  | 'cocoa'
  | 'cotton'
  | 'rice'
  | 'wheat'
  | 'maize'
  | 'soybean'
  | 'groundnut'
  | 'chili'
  | 'onion'
  | 'potato';

interface CropIconProps {
  name: CropIconName;
  size?: number;
  muted?: boolean;
}

export function CropIcon({ name, size = 24, muted = false }: CropIconProps) {
  const opacity = muted ? 0.7 : 1;

  if (name === 'grapes') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12.8 4.2c1.6-1.6 3.8-1.6 5.4-.1-1.3.5-2.6 1.2-3.8 2-.6-.7-1-1.3-1.6-1.9Z"
          fill="#16A34A"
          opacity={opacity}
        />
        <Circle cx="12" cy="9" r="2.2" fill="#7C3AED" opacity={opacity} />
        <Circle cx="9.2" cy="12" r="2.1" fill="#8B5CF6" opacity={opacity} />
        <Circle cx="14.8" cy="12" r="2.1" fill="#6D28D9" opacity={opacity} />
        <Circle cx="12" cy="14.8" r="2.1" fill="#7C3AED" opacity={opacity} />
        <Circle cx="9.8" cy="17.2" r="1.8" fill="#8B5CF6" opacity={opacity} />
        <Circle cx="14.2" cy="17.2" r="1.8" fill="#6D28D9" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'mango') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M5.5 13.8C5.5 7.5 11 4.2 16.7 6c3.2 1 4.9 4.6 3.7 8-1.3 3.8-5.2 6.4-9.3 6-3.2-.3-5.6-2.6-5.6-6.2Z"
          fill="#F59E0B"
          opacity={opacity}
        />
        <Path
          d="M8.4 12.2c0-2.7 2.6-4.6 5.2-3.9 1.7.4 2.6 2.3 1.9 4-1 2.5-3.6 3.8-5.3 3-.9-.4-1.8-1.6-1.8-3.1Z"
          fill="#FBBF24"
          opacity={opacity}
        />
        <Path
          d="M13.3 5.2c1.8-2 4.3-2.1 6.1-.4-1.8.8-3.5 1.7-5.3 2.8-.5-.9-.8-1.7-.8-2.4Z"
          fill="#16A34A"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'pomegranate') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M7 7.2 9.6 4.6 12 7.2l2.4-2.6L17 7.2 16.1 9H7.9L7 7.2Z"
          fill="#B91C1C"
          opacity={opacity}
        />
        <Path d="M11.4 3h1.2v2.2h-1.2z" fill="#7C2D12" opacity={opacity} />
        <Circle cx="12" cy="14" r="6.7" fill="#DC2626" opacity={opacity} />
        <Circle cx="10" cy="13" r="1.1" fill="#FDE68A" opacity={opacity} />
        <Circle cx="14" cy="15" r="1.1" fill="#FDE68A" opacity={opacity} />
        <Circle cx="12.6" cy="11.8" r="0.9" fill="#FDE68A" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'citrus') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="13" r="7" fill="#F59E0B" opacity={opacity} />
        <Circle cx="12" cy="13" r="5.2" fill="#FCD34D" opacity={opacity} />
        <Path
          d="M12 7.8v10.4M7.8 13h8.4M9.4 9.8l5.2 6.4M14.6 9.8 9.4 16.2"
          stroke="#F59E0B"
          strokeWidth="1.4"
          opacity={opacity}
        />
        <Path
          d="M13.2 6.1c1.5-1.6 3.6-1.6 5.1-.2-1.3.5-2.6 1.2-3.8 2-.5-.7-.9-1.3-1.3-1.8Z"
          fill="#16A34A"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'banana') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M2 6c6 5 12 11 12 16-4-1-8-5-12-16Z" fill="#EAB308" opacity={opacity} />
        <Path d="M4 10c4 3.5 9 9 9 12-3-1-6-4-9-12Z" fill="#FBBF24" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'tomato') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="13" r="6.5" fill="#DC2626" opacity={opacity} />
        <Path
          d="M12 5.2c2 0 3.8.7 5 1.9-2.5.2-4 .9-5 2.2-1-1.3-2.5-2-5-2.2 1.2-1.2 3-1.9 5-1.9Z"
          fill="#16A34A"
          opacity={opacity}
        />
        <Circle cx="10" cy="12" r="1.1" fill="#FCA5A5" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'sugarcane') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M7 20V6.5M11 20V5.5M15 20V7.5"
          stroke="#16A34A"
          strokeWidth="2"
          opacity={opacity}
        />
        <Path
          d="M6 10h2M10 9h2M14 11h2M10 14h2M14 15h2M6 16h2"
          stroke="#65A30D"
          strokeWidth="1.2"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'guava') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="10.5" cy="13" r="5.5" fill="#22C55E" opacity={opacity} />
        <Circle cx="13.5" cy="13" r="5.5" fill="#4ADE80" opacity={opacity} />
        <Circle cx="12" cy="13" r="3.2" fill="#FBCFE8" opacity={opacity} />
        <Path
          d="M12.6 6.8c1.1-1.4 2.7-1.7 4-.8-1.2.5-2.3 1-3.3 1.8-.3-.4-.5-.7-.7-1Z"
          fill="#15803D"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'apple') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 8.5c4.4-2.6 8.5 1.8 7.2 6-1.2 3.8-4.5 6.2-7.2 6.2s-6-2.4-7.2-6.2c-1.3-4.2 2.8-8.6 7.2-6Z"
          fill="#EF4444"
          opacity={opacity}
        />
        <Path
          d="M12 7c1.1-2.1 3-3.1 5-2.7-1.8 1.1-3.1 2.2-4 3.9-.2-.3-.6-.7-1-1.2Z"
          fill="#166534"
          opacity={opacity}
        />
        <Path
          d="M11 5.5c.6-.7 1.5-1.1 2.3-1-.4.8-1 1.4-1.8 1.8-.2-.2-.3-.5-.5-.8Z"
          fill="#15803D"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'pear') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 6.8c2.4 0 4.2 1.6 4.2 4 0 1.2-.5 2.3-1.3 3.1 1.5 1 2.4 2.8 2.4 4.8 0 2.6-2 4.5-5.3 4.5s-5.3-1.9-5.3-4.5c0-2 .9-3.8 2.4-4.8-.8-.8-1.3-1.9-1.3-3.1 0-2.4 1.8-4 4.2-4Z"
          fill="#84CC16"
          opacity={opacity}
        />
        <Path
          d="M12.4 5.4c1-1.7 2.7-2.6 4.4-2.3-1.5.9-2.4 1.8-3.1 3.3-.4-.2-.8-.5-1.3-1Z"
          fill="#15803D"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'peach') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="13" r="6.5" fill="#FB923C" opacity={opacity} />
        <Path
          d="M12 7.3c1.8 1.6 2 6.5 0 11.4"
          stroke="#EA580C"
          strokeWidth="1.2"
          opacity={opacity}
        />
        <Path
          d="M12.6 6c1.2-1.7 3-2.1 4.7-1.2-1.4.6-2.5 1.2-3.5 2.2-.4-.3-.8-.6-1.2-1Z"
          fill="#16A34A"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'plum') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 6.5c3.8 0 6.5 2.8 6.5 6.7 0 4.1-2.8 7.2-6.5 7.2s-6.5-3.1-6.5-7.2c0-3.9 2.7-6.7 6.5-6.7Z"
          fill="#7C3AED"
          opacity={opacity}
        />
        <Circle cx="10.2" cy="11.7" r="1.2" fill="#C4B5FD" opacity={opacity} />
        <Path
          d="M12.9 5.7c1.1-1.3 2.7-1.6 4.1-.8-1.1.4-2.1.9-3 1.7-.3-.3-.6-.5-1.1-.9Z"
          fill="#15803D"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'cherry') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="9" cy="15.5" r="3.6" fill="#DC2626" opacity={opacity} />
        <Circle cx="15" cy="15.5" r="3.6" fill="#B91C1C" opacity={opacity} />
        <Path
          d="M9 12c0-2.8 1.2-5 3.6-6.6M15 12c0-2.8-1.2-5-3.6-6.6M11.7 5.4c.9-1.2 2.2-1.6 3.4-1.2"
          stroke="#166534"
          strokeWidth="1.2"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'strawberry') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 7.1c4.1 0 6.7 2.7 6.1 6.9-.5 3.6-3.1 6.7-6.1 6.7S6.4 17.6 5.9 14C5.3 9.8 7.9 7.1 12 7.1Z"
          fill="#EF4444"
          opacity={opacity}
        />
        <Path
          d="M12 5c1.7 0 3.2.6 4.2 1.7-2 .1-3.2.6-4.2 1.5-1-1-2.2-1.4-4.2-1.5C8.8 5.6 10.3 5 12 5Z"
          fill="#16A34A"
          opacity={opacity}
        />
        <Circle cx="9.2" cy="12.1" r="0.5" fill="#FDE68A" opacity={opacity} />
        <Circle cx="12" cy="13.2" r="0.5" fill="#FDE68A" opacity={opacity} />
        <Circle cx="14.8" cy="12.1" r="0.5" fill="#FDE68A" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'blueberry') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="13" r="6.4" fill="#2563EB" opacity={opacity} />
        <Circle cx="12" cy="13" r="4.8" fill="#3B82F6" opacity={opacity} />
        <Path d="M9.5 8.5 12 6.7l2.5 1.8-1 2.2h-3z" fill="#1D4ED8" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'raspberry') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="9.2" cy="11.2" r="1.8" fill="#EC4899" opacity={opacity} />
        <Circle cx="12" cy="10.8" r="1.9" fill="#F472B6" opacity={opacity} />
        <Circle cx="14.8" cy="11.2" r="1.8" fill="#EC4899" opacity={opacity} />
        <Circle cx="10.1" cy="14" r="1.8" fill="#F472B6" opacity={opacity} />
        <Circle cx="13.9" cy="14" r="1.8" fill="#EC4899" opacity={opacity} />
        <Circle cx="12" cy="16.5" r="1.9" fill="#DB2777" opacity={opacity} />
        <Path
          d="M12.6 7c1-1.3 2.4-1.5 3.7-.8-1 .4-2 .8-2.9 1.5-.2-.3-.5-.5-.8-.7Z"
          fill="#15803D"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'blackberry') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="9.2" cy="11.2" r="1.8" fill="#312E81" opacity={opacity} />
        <Circle cx="12" cy="10.8" r="1.9" fill="#4338CA" opacity={opacity} />
        <Circle cx="14.8" cy="11.2" r="1.8" fill="#312E81" opacity={opacity} />
        <Circle cx="10.1" cy="14" r="1.8" fill="#4F46E5" opacity={opacity} />
        <Circle cx="13.9" cy="14" r="1.8" fill="#312E81" opacity={opacity} />
        <Circle cx="12" cy="16.5" r="1.9" fill="#3730A3" opacity={opacity} />
        <Path
          d="M12.6 7c1-1.3 2.4-1.5 3.7-.8-1 .4-2 .8-2.9 1.5-.2-.3-.5-.5-.8-.7Z"
          fill="#15803D"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'papaya') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 5.8c4 0 6.8 2.9 6.8 7.2 0 4.3-2.8 7.2-6.8 7.2S5.2 17.3 5.2 13c0-4.3 2.8-7.2 6.8-7.2Z"
          fill="#FB923C"
          opacity={opacity}
        />
        <Path
          d="M12 8.4c2.5 0 4.2 1.8 4.2 4.6 0 2.8-1.7 4.6-4.2 4.6S7.8 15.8 7.8 13c0-2.8 1.7-4.6 4.2-4.6Z"
          fill="#FCD34D"
          opacity={opacity}
        />
        <Circle cx="10.4" cy="12.3" r="0.5" fill="#111827" opacity={opacity} />
        <Circle cx="12" cy="13.1" r="0.5" fill="#111827" opacity={opacity} />
        <Circle cx="13.6" cy="12.3" r="0.5" fill="#111827" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'pineapple') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 5.2 9.5 8.2 12 7.4l2.5.8L12 5.2Z" fill="#16A34A" opacity={opacity} />
        <Path d="M8.8 6.2 7 9.2l2.4-.9 1.2-2.1Z" fill="#22C55E" opacity={opacity} />
        <Path d="M15.2 6.2 17 9.2l-2.4-.9-1.2-2.1Z" fill="#22C55E" opacity={opacity} />
        <Path
          d="M12 8.2c3.1 0 5 2.4 4.6 5.9-.4 3.1-2.1 5.5-4.6 5.5s-4.2-2.4-4.6-5.5c-.4-3.5 1.5-5.9 4.6-5.9Z"
          fill="#FACC15"
          opacity={opacity}
        />
        <Path
          d="M9 10.2 15 16.2M15 10.2 9 16.2"
          stroke="#CA8A04"
          strokeWidth="1.1"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'coconut') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="13" r="6.4" fill="#92400E" opacity={opacity} />
        <Circle cx="12" cy="13" r="4.7" fill="#A16207" opacity={opacity} />
        <Circle cx="10.7" cy="11.7" r="0.6" fill="#D6D3D1" opacity={opacity} />
        <Circle cx="13.3" cy="11.9" r="0.6" fill="#D6D3D1" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'arecanut') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="10" cy="13.4" r="4.2" fill="#F59E0B" opacity={opacity} />
        <Circle cx="14.4" cy="13.2" r="4" fill="#FB923C" opacity={opacity} />
        <Path
          d="M12 8c1.1-1.8 2.7-2.6 4.6-2.3-1.6 1-2.8 2.1-3.5 3.8"
          stroke="#15803D"
          strokeWidth="1.1"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'cashew') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M14.7 6.8c2.1 0 3.5 1.3 3.5 3.2 0 1.6-.9 3.1-2.5 4 .5 2.2-.5 3.9-2.7 3.9-2.3 0-4.2-1.8-4.2-4.2 0-3.9 2.8-6.9 5.9-6.9Z"
          fill="#D97706"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'coffee') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 7.2c3.9 0 6.2 2.2 6.2 5.8s-2.3 5.8-6.2 5.8S5.8 16.6 5.8 13s2.3-5.8 6.2-5.8Z"
          fill="#78350F"
          opacity={opacity}
        />
        <Path
          d="M12 8.6c-1.2 1.1-1.6 2.8-1 4.4.5 1.4.5 2.6-.4 4"
          stroke="#D6D3D1"
          strokeWidth="1"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'tea') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M6 14.6c0-4.8 3.6-8.4 8.8-8.8-.8 5.2-4 8.8-8.8 8.8Z"
          fill="#22C55E"
          opacity={opacity}
        />
        <Path d="M7 14c3.5-1 6-3.5 7.5-7" stroke="#15803D" strokeWidth="1.2" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'cocoa') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 6.5c3.7 0 6 2.5 6 6.5s-2.3 6.5-6 6.5-6-2.5-6-6.5 2.3-6.5 6-6.5Z"
          fill="#A16207"
          opacity={opacity}
        />
        <Path
          d="M12 7.8v10.4M9.2 8.7c1 .8 1.5 2.5 1.5 4.3 0 1.7-.5 3.4-1.5 4.3M14.8 8.7c-1 .8-1.5 2.5-1.5 4.3 0 1.7.5 3.4 1.5 4.3"
          stroke="#FDE68A"
          strokeWidth="1"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'cotton') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="9" cy="13" r="3.1" fill="#F8FAFC" opacity={opacity} />
        <Circle cx="12.8" cy="12.2" r="3.2" fill="#FFFFFF" opacity={opacity} />
        <Circle cx="15.8" cy="14.1" r="2.7" fill="#F1F5F9" opacity={opacity} />
        <Path d="M12 19c.6-2.1.6-3.8-.2-5.4" stroke="#166534" strokeWidth="1.2" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'rice') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M10 20V7.2" stroke="#16A34A" strokeWidth="1.8" opacity={opacity} />
        <Path
          d="M10.3 9.5 13 8.5M10.3 11.5 13.4 10.2M10.3 13.6 13.7 12.2M10.3 15.7 13.9 14.1"
          stroke="#FDE68A"
          strokeWidth="1.1"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'wheat') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 20V6.5" stroke="#CA8A04" strokeWidth="1.6" opacity={opacity} />
        <Path
          d="M12 8.2 9.7 9.8M12 10.4 9.6 12M12 12.6 9.6 14.2M12 14.8 9.8 16.5M12 8.2 14.3 9.8M12 10.4 14.4 12M12 12.6 14.4 14.2M12 14.8 14.2 16.5"
          stroke="#FACC15"
          strokeWidth="1.1"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'maize') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 7.5c2.2 0 3.8 1.8 3.8 4.7 0 3-1.6 5.1-3.8 5.1s-3.8-2.1-3.8-5.1c0-2.9 1.6-4.7 3.8-4.7Z"
          fill="#FACC15"
          opacity={opacity}
        />
        <Circle cx="10.9" cy="10.5" r="0.45" fill="#EAB308" opacity={opacity} />
        <Circle cx="12" cy="10.9" r="0.45" fill="#EAB308" opacity={opacity} />
        <Circle cx="13.1" cy="10.5" r="0.45" fill="#EAB308" opacity={opacity} />
        <Path
          d="M8.2 16.5c1.1-2.7 1-5.5.5-8.1M15.8 16.5c-1.1-2.7-1-5.5-.5-8.1"
          stroke="#16A34A"
          strokeWidth="1.3"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'soybean') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="8.7" cy="13.3" r="2.4" fill="#84CC16" opacity={opacity} />
        <Circle cx="12.2" cy="12.2" r="2.5" fill="#A3E635" opacity={opacity} />
        <Circle cx="15.4" cy="13.8" r="2.2" fill="#65A30D" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'groundnut') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M10.3 8.4c1.7 0 2.9 1.2 2.9 3s-1.2 3-2.9 3-2.9-1.2-2.9-3 1.2-3 2.9-3Zm3.5 2.2c1.9 0 3.2 1.3 3.2 3.2S15.7 17 13.8 17s-3.2-1.3-3.2-3.2 1.3-3.2 3.2-3.2Z"
          fill="#B45309"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'chili') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M7.2 14.8c0-3.7 3.1-6.2 6.8-6.2 1.7 0 3.2.4 4.4 1.2-.9 4.1-3.9 7.1-7.9 7.6-1.8.2-3.3-.9-3.3-2.6Z"
          fill="#DC2626"
          opacity={opacity}
        />
        <Path
          d="M12.8 8.3c.8-1.5 2-2.3 3.7-2.2"
          stroke="#15803D"
          strokeWidth="1.3"
          opacity={opacity}
        />
      </Svg>
    );
  }

  if (name === 'onion') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 6.8c2.9 1.8 4.8 4.2 4.8 7 0 3.2-2.1 5.4-4.8 5.4s-4.8-2.2-4.8-5.4c0-2.8 1.9-5.2 4.8-7Z"
          fill="#A855F7"
          opacity={opacity}
        />
        <Path d="M12 6c.2-1.6 1-2.7 2.5-3.2" stroke="#16A34A" strokeWidth="1.2" opacity={opacity} />
      </Svg>
    );
  }

  if (name === 'potato') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 8.2c3.9 0 6.4 2 6.4 4.9 0 3-2.5 5.1-6.4 5.1s-6.4-2.1-6.4-5.1c0-2.9 2.5-4.9 6.4-4.9Z"
          fill="#A16207"
          opacity={opacity}
        />
        <Circle cx="9.4" cy="12.3" r="0.45" fill="#78350F" opacity={opacity} />
        <Circle cx="12.1" cy="13.4" r="0.45" fill="#78350F" opacity={opacity} />
        <Circle cx="14.7" cy="12.1" r="0.45" fill="#78350F" opacity={opacity} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9.5 5.2c1.6-1.7 3.9-1.8 5.6-.2-1.4.6-2.8 1.3-4.1 2.2-.6-.7-1-1.4-1.5-2Z"
        fill="#16A34A"
        opacity={opacity}
      />
      <Path
        d="M8 7.8c2.4-2.4 6.7-1.8 7.9 1 1.4 3.4-1.4 8.1-5.8 9.6-2.6.9-4.8-.7-4.8-3.4 0-3.1 1.1-5.5 2.7-7.2Z"
        fill="#FCD34D"
        opacity={opacity}
      />
      <Path
        d="M12.7 9.7c1.2-.2 2.3.4 2.6 1.5.4 1.6-1 3.7-3.1 4.5"
        stroke="#F59E0B"
        strokeWidth="1.4"
        opacity={opacity}
      />
    </Svg>
  );
}
