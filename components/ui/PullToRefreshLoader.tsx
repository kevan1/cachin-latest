import * as Haptics from "expo-haptics";
import { useEffect, type StyleProp, type ViewStyle } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type PullToRefreshLoaderProps = {
  progress: SharedValue<number>;
  refreshing: boolean;
  enableHaptics?: boolean;
  color?: string;
  size?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const FULL_PROGRESS_THRESHOLD = 1;
const REFRESH_TRIGGER_THRESHOLD = 1.1;

const triggerHapticFeedback = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export function PullToRefreshLoader({
  progress,
  refreshing,
  enableHaptics = true,
  color = "rgba(0,0,0,0.65)",
  size = 40,
  strokeWidth = 3,
  style,
}: PullToRefreshLoaderProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const spinRotation = useSharedValue(0);
  const fullProgressHapticFired = useSharedValue(false);
  const triggerProgressHapticFired = useSharedValue(false);

  useAnimatedReaction(
    () => progress.value,
    (nextProgress) => {
      if (!enableHaptics || refreshing) return;

      if (nextProgress >= FULL_PROGRESS_THRESHOLD && !fullProgressHapticFired.value) {
        fullProgressHapticFired.value = true;
        runOnJS(triggerHapticFeedback)();
      }

      if (nextProgress >= REFRESH_TRIGGER_THRESHOLD && !triggerProgressHapticFired.value) {
        triggerProgressHapticFired.value = true;
        runOnJS(triggerHapticFeedback)();
      }

      if (nextProgress < 0.9) {
        fullProgressHapticFired.value = false;
        triggerProgressHapticFired.value = false;
      }
    },
    [enableHaptics, refreshing]
  );

  useEffect(() => {
    if (refreshing) {
      spinRotation.value = withRepeat(withTiming(360, { duration: 850 }), -1, false);
      return;
    }

    cancelAnimation(spinRotation);
    spinRotation.value = 0;
  }, [refreshing, spinRotation]);

  useEffect(() => {
    if (refreshing) return;
    fullProgressHapticFired.value = false;
    triggerProgressHapticFired.value = false;
  }, [refreshing, fullProgressHapticFired, triggerProgressHapticFired]);

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const clampedProgress = Math.max(0, Math.min(progress.value, REFRESH_TRIGGER_THRESHOLD));
    const opacity = refreshing
      ? 1
      : interpolate(clampedProgress, [0, 0.2, 1], [0, 0.5, 1], Extrapolation.CLAMP);
    const scale = refreshing
      ? 1
      : interpolate(clampedProgress, [0, 1], [0.82, 1], Extrapolation.CLAMP);
    const translateY = refreshing
      ? 0
      : interpolate(clampedProgress, [0, REFRESH_TRIGGER_THRESHOLD], [-16, 0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const spinnerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  const progressAnimatedProps = useAnimatedProps(() => {
    const clampedProgress = refreshing ? 0.32 : Math.max(0, Math.min(progress.value, 1));

    return {
      strokeDashoffset: circumference * (1 - clampedProgress),
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.container, style, containerAnimatedStyle]}>
      <Animated.View style={spinnerAnimatedStyle}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[circumference, circumference]}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            animatedProps={progressAnimatedProps}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
