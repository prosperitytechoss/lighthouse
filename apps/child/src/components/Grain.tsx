import { Image, View } from "react-native";

const tile = require("../../assets/grain-light.png");

export function Grain() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Image source={tile} resizeMode="repeat" style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
