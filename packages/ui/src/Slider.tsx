import { useRef, useState } from "react";
import { PanResponder, View } from "react-native";

export type SliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

/**
 * Minimal touch slider built on PanResponder (no native dependency). Brand-cyan
 * fill + white thumb. Used for the screen-time daily cap.
 */
export function Slider({ value, min, max, step, onChange }: SliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const setFromX = (x: number) => {
    const w = widthRef.current || 1;
    const ratio = Math.max(0, Math.min(1, x / w));
    const raw = min + ratio * (max - min);
    const stepped = Math.round((raw - min) / step) * step + min;
    onChange(Math.max(min, Math.min(max, stepped)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <View
      className="h-9 justify-center"
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      {...pan.panHandlers}
    >
      <View className="h-1.5 overflow-hidden rounded-pill bg-neutral-200">
        <View className="h-1.5 rounded-pill bg-primary" style={{ width: `${pct}%` }} />
      </View>
      <View
        className="absolute h-5 w-5 rounded-pill border-2 border-white bg-primary shadow"
        style={{ left: Math.max(0, (pct / 100) * width - 10) }}
      />
    </View>
  );
}
