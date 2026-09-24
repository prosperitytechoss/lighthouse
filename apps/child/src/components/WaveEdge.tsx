import { useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

const PERIOD = 10;
const HEIGHT = 10;

function wavePath(width: number): string {
  const parts = [`M0 ${HEIGHT} L0 5 Q5 0 ${PERIOD} 5`];
  for (let x = PERIOD * 2; x <= width + PERIOD; x += PERIOD) parts.push(`T${x} 5`);
  parts.push(`L${width + PERIOD} ${HEIGHT} Z`);
  return parts.join(" ");
}

export function WaveEdge({ color = "#FFFFFF" }: { color?: string }) {
  const { width } = useWindowDimensions();
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      style={{ position: "absolute", left: 0, bottom: -1 }}
    >
      <Path d={wavePath(width)} fill={color} />
    </Svg>
  );
}
