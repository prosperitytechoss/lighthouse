import { shadows } from "@lighthouse/tokens";
import { Portal } from "@rn-primitives/portal";
import { Check, Info, TriangleAlert, X } from "lucide-react-native";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";

export type ToastType = "success" | "error" | "info";

type ToastApi = {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: () => void;
};

type ToastState = { id: number; message: string; type: ToastType };

const ToastContext = createContext<ToastApi | null>(null);

/** Imperative toast API. Must be used inside <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const DEFAULT_DURATION = 3200;

const STYLE: Record<ToastType, { tint: string; Icon: typeof Check }> = {
  success: { tint: "#16A34A", Icon: Check },
  error: { tint: "#DC2626", Icon: TriangleAlert },
  info: { tint: "#1CABE2", Icon: Info },
};

/** Wrap the app once. Renders the active toast through the app Portal. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, type: ToastType = "info") => {
    counter.current += 1;
    setToast({ id: counter.current, message, type });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
      dismiss: () => setToast(null),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Portal name={`lh-toast-${toast.id}`}>
          <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} />
        </Portal>
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const { tint, Icon } = STYLE[toast.type];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && onDone());
    }, DEFAULT_DURATION);

    return () => clearTimeout(t);
  }, [anim, onDone]);

  const style = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[style, { position: "absolute", left: 0, right: 0, bottom: insets.bottom + 16 }]}
      className="items-center px-xl"
    >
      <Pressable
        onPress={onDone}
        accessibilityRole="alert"
        className="w-full max-w-[440px] flex-row items-center gap-md rounded-2xl bg-white px-md py-md"
        style={shadows.e3}
      >
        <View
          className="h-7 w-7 items-center justify-center rounded-pill"
          style={{ backgroundColor: `${tint}1A` }}
        >
          <Icon size={16} color={tint} strokeWidth={2.5} />
        </View>
        <Text variant="body-sm" className="flex-1 leading-5 text-foreground">
          {toast.message}
        </Text>
        <X size={16} color="#94A3B8" />
      </Pressable>
    </Animated.View>
  );
}
