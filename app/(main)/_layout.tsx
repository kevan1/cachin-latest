import { Tabs, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import {
  Platform,
  View,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";

const TAB_BAR_WIDTH = 240;

const isOnScanScreen = (segments: string[]) => segments.includes("scanner");

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const segments = useSegments();
  const palette = Colors[colorScheme];
  const blurEffect =
    colorScheme === "dark" ? "systemChromeMaterialDark" : "systemChromeMaterialLight";
  const tabBarBottom = Platform.OS === "ios" ? 0 : Math.max(insets.bottom + 10, 18);

  const tabsContent =
    Platform.OS === "ios" ? (
      <NativeTabs
        backgroundColor={palette.background}
        blurEffect={blurEffect}
        iconColor={palette.secondaryText}
        labelStyle={{
          color: palette.secondaryText,
          fontSize: 11,
          fontWeight: "600",
        }}
        tintColor={palette.primary}
      >
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="scanner">
          <NativeTabs.Trigger.Icon
            sf={{ default: "qrcode.viewfinder", selected: "qrcode.viewfinder" }}
          />
          <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="camera-view"
          role="search"
          hidden={!isOnScanScreen(segments)}
        >
          <NativeTabs.Trigger.Label>qr</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "qrcode", selected: "qrcode" }} />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="supermarkets">
          <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} />
          <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore" hidden />
      </NativeTabs>
    ) : (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: "rgba(0,0,0,0.92)",
          tabBarInactiveTintColor: "rgba(0,0,0,0.36)",
          tabBarBackground: () => <GlassView style={styles.tabBarBackground} intensity={28} />,
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: tabBarBottom,
            },
          ],
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <View style={styles.iconContainer}>
                <IconSymbol size={24} name="house.fill" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="scanner"
          options={{
            title: "Scan",
            tabBarIcon: ({ color }) => (
              <View style={styles.iconContainer}>
                <IconSymbol size={24} name="qrcode.viewfinder" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="camera-view"
          options={{
            href: null, // Native-only tab, hide on JS tabs
          }}
        />
        <Tabs.Screen
          name="supermarkets"
          options={{
            title: "Map",
            tabBarIcon: ({ color }) => (
              <View style={styles.iconContainer}>
                <IconSymbol size={24} name="map.fill" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            href: null, // This hides the tab from the tab bar
          }}
        />
      </Tabs>
    );

  return (
    <View style={styles.layoutContainer}>
      {tabsContent}
    </View>
  );
}

const styles = StyleSheet.create({
  layoutContainer: {
    flex: 1,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    width: TAB_BAR_WIDTH,
    alignSelf: "center",
    height: 56,
    borderRadius: 28,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    paddingTop: 8,
    paddingBottom: 8,
    overflow: "hidden",
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
});
