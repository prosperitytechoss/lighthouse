import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

export function LhMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <Rect width={220} height={220} rx={52} fill="#1CABE2" />
      <Circle cx={110} cy={50} r={80} fill="#FFD44D" fillOpacity={0.18} />
      <G transform="translate(25 25) scale(1.1333)">
        <Rect x={64} y={24} width={22} height={14} rx={4} fill="#FFD44D" />
        <Path d="M60 22 Q75 8 90 22 Z" fill="#0E7FA8" />
        <Circle cx={75} cy={12} r={3.5} fill="#0E7FA8" />
        <Path d="M58 40 L92 40 L100 128 L50 128 Z" fill="#FFFFFF" stroke="#D9E6EE" strokeWidth={2} />
        <Path d="M56 56 L94 56 L96 72 L54 72 Z" fill="#0E7FA8" />
        <Path d="M52 92 L98 92 L100 108 L50 108 Z" fill="#0E7FA8" />
        <Circle cx={68} cy={82} r={3} fill="#1A1A1A" />
        <Circle cx={82} cy={82} r={3} fill="#1A1A1A" />
        <Path d="M69 87 Q75 92 81 87" fill="none" stroke="#1A1A1A" strokeWidth={2.4} strokeLinecap="round" />
        <Ellipse cx={75} cy={132} rx={44} ry={8} fill="#FFFFFF" fillOpacity={0.35} />
      </G>
    </Svg>
  );
}
