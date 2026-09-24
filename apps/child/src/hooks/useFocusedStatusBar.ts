import { useFocusEffect } from "@react-navigation/native";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback } from "react";

/**
 * Set the OS status bar style only while this screen is focused, reverting to
 * the app default ("dark", for white backgrounds) on blur. Avoids one screen's
 * style leaking into the next.
 */
export function useFocusedStatusBar(style: "light" | "dark") {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
      return () => {
        if (style !== "dark") setStatusBarStyle("dark");
      };
    }, [style]),
  );
}
