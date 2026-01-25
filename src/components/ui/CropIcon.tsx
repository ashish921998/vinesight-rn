import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type CropIconName = 'grapes' | 'mango' | 'pomegranate' | 'citrus' | 'banana';

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
