import { colors } from "@lighthouse/tokens";
import { View } from "react-native";


/** Onboarding pagination — active dot is a 24px pill, inactive are 8px gray. */
export function ProgressDots({ count = 4, active = 0 }: { count?: number; active?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === active ? colors.primary.DEFAULT : "#E5E7EB",
          }}
        />
      ))}
    </View>
  );
}
