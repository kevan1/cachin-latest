import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { getThemeTabColors, type ThemeTabColors } from "@/constants/themes";

export const ANDROID_GLASS_TAB_HEIGHT = 80;

const DEFAULT_TAB_COLORS = getThemeTabColors("blue");
const BAR_HORIZONTAL_MARGIN = 14;
const BAR_MAX_WIDTH = 960;
const BAR_INSET = 6;
const TAB_GAP = 6;

type TabVisual = {
  label: string;
  icon: (color: string) => ReactNode;
};

const TAB_VISUALS: Record<string, TabVisual> = {
  home: {
    label: "Home",
    icon: (color) => <MaterialIcons name="home-filled" size={30} color={color} />,
  },
  card: {
    label: "Card",
    icon: (color) => <Ionicons name="card-outline" size={25} color={color} />,
  },
  scanner: {
    label: "Scan",
    icon: (color) => <Ionicons name="qr-code-outline" size={25} color={color} />,
  },
  map: {
    label: "Map",
    icon: (color) => <Ionicons name="map-outline" size={25} color={color} />,
  },
};

const VISIBLE_TAB_NAMES = Object.keys(TAB_VISUALS);

function TabButton({
  label,
  icon,
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  activeColor,
  inactiveColor,
}: {
  label: string;
  icon: ReactNode;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  activeColor: string;
  inactiveColor: string;
}) {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: 180,
    });
  }, [isFocused, progress]);

  const animatedContentStyle = useAnimatedStyle(() => {
    const scale = 0.96 + progress.value * 0.04;
    const opacity = 0.84 + progress.value * 0.16;
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabPressable}
    >
      <Animated.View style={[styles.tabContent, animatedContentStyle]}>
        {icon}
        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : inactiveColor,
              fontWeight: isFocused ? "700" : "600",
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function GlassTabBar({
  state,
  descriptors,
  navigation,
  tabColors = DEFAULT_TAB_COLORS,
}: BottomTabBarProps & { tabColors?: ThemeTabColors }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visibleRoutes = state.routes.filter(
    (route) => VISIBLE_TAB_NAMES.includes(route.name)
  );
  const routeCount = Math.max(1, visibleRoutes.length);
  const barWidth = Math.min(width - BAR_HORIZONTAL_MARGIN * 2, BAR_MAX_WIDTH);
  const itemWidth = (barWidth - BAR_INSET * 2 - TAB_GAP * (routeCount - 1)) / routeCount;
  const focusedRoute = state.routes[state.index];
  const fallbackFocusedName =
    focusedRoute?.name === "camera-view" ? "scanner" : focusedRoute?.name;
  const focusedVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.name === fallbackFocusedName)
  );
  const activeIndex = useSharedValue(focusedVisibleIndex);

  useEffect(() => {
    activeIndex.value = withSpring(focusedVisibleIndex, {
      damping: 16,
      stiffness: 220,
      mass: 0.4,
    });
  }, [focusedVisibleIndex, activeIndex]);

  const activePillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: activeIndex.value * (itemWidth + TAB_GAP),
      },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          paddingBottom: Math.max(10, insets.bottom + 2),
        },
      ]}
    >
      <BlurView
        experimentalBlurMethod="dimezisBlurView"
        intensity={20}
        tint="light"
        style={[
          styles.navPill,
          {
            width: barWidth,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            {
              width: itemWidth,
              backgroundColor: tabColors.activePill,
            },
            activePillStyle,
          ]}
        />

        {visibleRoutes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const isFocused = focusedRoute?.key === route.key;
          const tabVisual = TAB_VISUALS[route.name] ?? {
            label: options.title ?? route.name,
            icon: (color: string) => <Ionicons name="ellipse-outline" size={24} color={color} />,
          };

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <View
              key={route.key}
              style={[
                styles.tabSlot,
                {
                  width: itemWidth,
                },
              ]}
            >
              <TabButton
                label={tabVisual.label}
                icon={tabVisual.icon(isFocused ? tabColors.active : tabColors.inactive)}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                activeColor={tabColors.active}
                inactiveColor={tabColors.inactive}
              />
            </View>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  navPill: {
    height: ANDROID_GLASS_TAB_HEIGHT,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: 1.1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(238,245,249,0.28)",
    paddingHorizontal: BAR_INSET,
    paddingVertical: BAR_INSET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TAB_GAP,
  },
  activePill: {
    position: "absolute",
    top: BAR_INSET,
    bottom: BAR_INSET,
    left: BAR_INSET,
    borderRadius: 32,
    backgroundColor: DEFAULT_TAB_COLORS.activePill,
  },
  tabSlot: {
    height: "100%",
    borderRadius: 32,
    overflow: "hidden",
  },
  tabPressable: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabLabel: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
