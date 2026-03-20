import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { G, Path } from "react-native-svg";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const BUTTON_HEIGHT = 64;
const BUTTON_PADDING = 6;
const THUMB_RADIUS_RATIO = 1.6;
const CHIN_HEIGHT = 110;

function hslToHex(h: number, s: number, l: number) {
  const lightness = l / 100;
  const chroma = (s * Math.min(lightness, 1 - lightness)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lightness - chroma * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateRainbowColors(steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const hue = (index / steps) * 360;
    return hslToHex(hue, 100, 70);
  });
}

function ConicGradient({ size, colors }: { size: number; colors: string[] }) {
  const radius = size / 2;
  const center = size / 2;
  const segments = colors.length;
  const angleStep = 360 / segments;
  const degToRad = (deg: number) => (deg * Math.PI) / 180;
  const overlap = 0.5;

  const paths = colors.map((color, index) => {
    const startAngle = index * angleStep - overlap;
    const endAngle = (index + 1) * angleStep + overlap;
    const paddedRadius = radius + 2;

    const x1 = center + paddedRadius * Math.cos(degToRad(startAngle));
    const y1 = center + paddedRadius * Math.sin(degToRad(startAngle));
    const x2 = center + paddedRadius * Math.cos(degToRad(endAngle));
    const y2 = center + paddedRadius * Math.sin(degToRad(endAngle));

    const d = `M ${center} ${center} L ${x1} ${y1} A ${paddedRadius} ${paddedRadius} 0 0 1 ${x2} ${y2} Z`;
    return (
      <Path key={index} d={d} fill={color} stroke={color} strokeWidth={2} />
    );
  });

  return (
    <Svg height={size} width={size}>
      <G>{paths}</G>
    </Svg>
  );
}

function RainbowThumb({ thumbWidth, thumbHeight }: { thumbWidth: number; thumbHeight: number }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const smoothRainbow = useMemo(() => generateRainbowColors(60), []);
  const diagonal = Math.sqrt(thumbWidth ** 2 + thumbHeight ** 2);

  return (
    <View style={[styles.thumbMask, { borderRadius: thumbHeight / 2 }]}>
      <Animated.View style={[styles.thumbGradientContainer, style]}>
        <ConicGradient size={diagonal + 10} colors={smoothRainbow} />
      </Animated.View>
    </View>
  );
}

function AnimatedBorder({ size }: { size: number }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const smoothRainbow = useMemo(() => generateRainbowColors(90), []);

  return (
    <View style={styles.borderCenterWrapper}>
      <Animated.View style={style}>
        <ConicGradient size={size} colors={smoothRainbow} />
      </Animated.View>
    </View>
  );
}

function ShimmerChar({
  char,
  index,
  progress,
  maxIndex,
}: {
  char: string;
  index: number;
  progress: Animated.SharedValue<number>;
  maxIndex: number;
}) {
  const style = useAnimatedStyle(() => {
    const activeIndex = interpolate(progress.value, [0, 1], [-3, maxIndex + 3]);
    const diff = Math.abs(index - activeIndex);
    const color = interpolateColor(
      diff,
      [0, 1.5, 3],
      ["#FFFFFF", "#AAAAAA", "#555555"]
    );

    return { color };
  });

  return (
    <Animated.Text style={[styles.swipeTextChar, style]}>{char}</Animated.Text>
  );
}

function ShimmerText({ label }: { label: string }) {
  const progress = useSharedValue(0);
  const chars = label.split("");
  const maxIndex = chars.length - 1;

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, [progress]);

  return (
    <View style={styles.textRow}>
      {chars.map((char, i) => (
        <ShimmerChar
          key={`${char}-${i}`}
          char={char}
          index={i}
          progress={progress}
          maxIndex={maxIndex}
        />
      ))}
    </View>
  );
}

type ChinConfig = {
  label: string;
  onComplete?: () => void;
};

type ChinPopoutContextValue = {
  showChin: (config?: Partial<ChinConfig>) => void;
  hideChin: () => void;
  progress: Animated.SharedValue<number>;
  config: ChinConfig;
  isOpen: boolean;
};

const ChinPopoutContext = createContext<ChinPopoutContextValue | null>(null);

const DEFAULT_CONFIG: ChinConfig = {
  label: "Swipe to continue",
};

export function ChinPopoutProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ChinConfig>(DEFAULT_CONFIG);

  const showChin = useCallback(
    (nextConfig?: Partial<ChinConfig>) => {
      setConfig((prev) => ({ ...prev, ...nextConfig }));
      setIsOpen(true);
      progress.value = withTiming(1, {
        duration: 500,
        easing: Easing.inOut(Easing.cubic),
      });
    },
    [progress]
  );

  const hideChin = useCallback(() => {
    progress.value = withTiming(
      0,
      {
        duration: 450,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setIsOpen)(false);
        }
      }
    );
  }, [progress]);

  const value = useMemo(
    () => ({ showChin, hideChin, progress, config, isOpen }),
    [showChin, hideChin, progress, config, isOpen]
  );

  return (
    <ChinPopoutContext.Provider value={value}>
      {children}
    </ChinPopoutContext.Provider>
  );
}

export function useChinPopout() {
  const context = useContext(ChinPopoutContext);
  if (!context) {
    throw new Error("useChinPopout must be used within ChinPopoutProvider");
  }
  return context;
}

type ChinPopoutOverlayProps = {
  showBackdrop?: boolean;
  backdropColor?: string;
  backdropHeight?: number;
  backdropRadius?: number;
  backdropHorizontalInset?: number;
  backdropCutoutColor?: string;
  backdropCutoutHeight?: number;
  backdropCutoutRadius?: number;
  backdropCutoutHorizontalInset?: number;
  maxTrackWidth?: number;
  useModal?: boolean;
  bottomPadding?: number;
  trackOffsetY?: number;
  allowPassthrough?: boolean;
  chinHeight?: number;
  includeSafeArea?: boolean;
};

export function ChinPopoutOverlay({
  showBackdrop = false,
  backdropColor = "#121212",
  backdropHeight = 150,
  backdropRadius = 32,
  backdropHorizontalInset = 0,
  backdropCutoutColor,
  backdropCutoutHeight = 0,
  backdropCutoutRadius = 0,
  backdropCutoutHorizontalInset = 0,
  maxTrackWidth,
  useModal = true,
  bottomPadding = 8,
  trackOffsetY = 0,
  allowPassthrough = false,
  chinHeight = CHIN_HEIGHT,
  includeSafeArea = true,
}: ChinPopoutOverlayProps) {
  const { progress, config, hideChin, isOpen } = useChinPopout();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const trackWidth = Math.max(
    240,
    Math.min(width - 48, maxTrackWidth ?? width - 48)
  );
  const thumbHeight = BUTTON_HEIGHT - BUTTON_PADDING * 2;
  const thumbWidth = thumbHeight * THUMB_RADIUS_RATIO;
  const maxSlide = trackWidth - thumbWidth - BUTTON_PADDING * 2;

  const dragX = useSharedValue(0);
  const onCompleteRef = useRef(config.onComplete);
  onCompleteRef.current = config.onComplete;

  const handleComplete = useCallback(() => {
    onCompleteRef.current?.();
    hideChin();
  }, [hideChin]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          let newValue = gestureState.dx;
          if (newValue < 0) newValue = 0;
          if (newValue > maxSlide) newValue = maxSlide;
          dragX.value = newValue;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > maxSlide * 0.8) {
            dragX.value = withTiming(maxSlide, {}, () => {
              runOnJS(handleComplete)();
              dragX.value = withTiming(0);
            });
          } else {
            dragX.value = withSpring(0);
          }
        },
      }),
    [dragX, handleComplete, maxSlide]
  );

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1]),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [20, 0]),
      },
    ],
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  const diagonal = Math.sqrt(trackWidth ** 2 + BUTTON_HEIGHT ** 2);
  const borderSize = diagonal + 50;
  const overlayHeight = Math.max(
    chinHeight,
    showBackdrop ? backdropHeight : 0
  );

  if (!isOpen) return null;

  const content = (
    <View
      style={useModal ? styles.modalRoot : [styles.modalRoot, styles.modalRootInline]}
      pointerEvents={allowPassthrough ? "box-none" : "auto"}
    >
      <View
        pointerEvents={allowPassthrough ? "box-none" : "auto"}
        style={[
          styles.overlay,
          { height: overlayHeight },
        ]}
      >
        {showBackdrop ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.backdrop,
                {
                  backgroundColor: backdropColor,
                  height: backdropHeight,
                  borderTopLeftRadius: backdropRadius,
                  borderTopRightRadius: backdropRadius,
                  marginHorizontal: backdropHorizontalInset,
                },
              ]}
            />
            {backdropCutoutColor && backdropCutoutHeight > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.backdropCutout,
                  {
                    backgroundColor: backdropCutoutColor,
                    height: backdropCutoutHeight,
                    borderBottomLeftRadius: backdropCutoutRadius,
                    borderBottomRightRadius: backdropCutoutRadius,
                    marginHorizontal: backdropCutoutHorizontalInset,
                    bottom: Math.max(0, backdropHeight - backdropCutoutHeight),
                  },
                ]}
              />
            ) : null}
          </>
        ) : null}
        <View
          style={[
            styles.chinArea,
            {
              height: chinHeight,
              paddingBottom: bottomPadding + (includeSafeArea ? insets.bottom : 0),
            },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.chinContent,
              containerStyle,
              {
                width: trackWidth,
                height: BUTTON_HEIGHT,
                marginBottom: trackOffsetY,
              },
            ]}
            pointerEvents="auto"
          >
            <View
              style={[
                styles.trackBorderContainer,
                { borderRadius: BUTTON_HEIGHT / 2 },
              ]}
            >
              <AnimatedBorder size={borderSize} />
              <View
                style={[
                  styles.trackInner,
                  { borderRadius: BUTTON_HEIGHT / 2 - 1 },
                ]}
              >
                <ShimmerText label={config.label} />
              </View>
            </View>

            <Animated.View
              style={[
                styles.thumbContainer,
                thumbAnimatedStyle,
                { width: thumbWidth, height: thumbHeight, left: BUTTON_PADDING },
              ]}
              {...panResponder.panHandlers}
            >
              <RainbowThumb thumbWidth={thumbWidth} thumbHeight={thumbHeight} />
              <MaterialIcons name="arrow-forward" size={30} color="#000" />
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </View>
  );

  if (!useModal) {
    return content;
  }

  return (
    <Modal transparent visible statusBarTranslucent onRequestClose={hideChin}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalRootInline: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 20,
    elevation: 20,
  },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    zIndex: 0,
  },
  backdropCutout: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1,
  },
  chinContent: {
    justifyContent: "center",
    alignSelf: "center",
    zIndex: 1,
  },
  chinArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  trackBorderContainer: {
    ...StyleSheet.absoluteFillObject,
    padding: 1.5,
    overflow: "hidden",
  },
  borderCenterWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  trackInner: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 30,
  },
  swipeTextChar: {
    fontSize: 17,
    fontWeight: "500",
  },
  thumbContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbMask: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbGradientContainer: {
    width: "200%",
    height: "200%",
    justifyContent: "center",
    alignItems: "center",
  },
});
