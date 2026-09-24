import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { BRAND_LOGOS, type BrandLogoId } from "./brandLogos";

/** The eight monitored platforms, lowercase ids matching dummy-data packages. */
export type AppId = BrandLogoId;

/**
 * Official brand mark (Simple Icons, each brand's own color) centered on a
 * light #F5F7FB tile — board 38 "Real app logos". Falls back to an empty tile
 * for unknown ids.
 */
export function AppIcon({ app, size = 32 }: { app: string; size?: number }) {
  const logo = BRAND_LOGOS[app as AppId];
  const glyph = Math.round(size * 0.56);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: "#F5F7FB",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {logo ? (
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <Path d={logo.d} fill={logo.fill} />
        </Svg>
      ) : null}
    </View>
  );
}
