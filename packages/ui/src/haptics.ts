import * as Haptics from "expo-haptics";

/**
 * Tactile feedback so buttons feel like real buttons. Fire on `onPressIn` (not
 * onPress) so the buzz lands the instant a finger lands, the way iOS does it.
 *
 *   select  light tick for taps, rows, chips, toggles, nav
 *   light   a primary action button
 *   medium  a heavier or destructive action
 *   success a completed flow (paired, granted, saved)
 *
 * Every call is fire and forget; failures (e.g. simulator) are swallowed.
 */
function safe(run: () => Promise<unknown>) {
  return () => {
    void run().catch(() => {});
  };
}

export const haptics = {
  select: safe(() => Haptics.selectionAsync()),
  light: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
