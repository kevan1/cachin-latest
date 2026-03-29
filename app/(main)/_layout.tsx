import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";
import { useEffect, useState } from "react";
import { ANDROID_GLASS_TAB_HEIGHT, GlassTabBar } from "@/components/GlassTabBar";
import { getThemeTabColors } from "@/constants/themes";
import {
  loadThemePreference,
  subscribeThemePreference,
} from "@/utils/themePreferences";

const isAndroid = Platform.OS === "android";

export default function TabLayout() {
  const [themeId, setThemeId] = useState("blue");
  const tabColors = getThemeTabColors(themeId);

  useEffect(() => {
    let isMounted = true;

    loadThemePreference()
      .then((storedThemeId) => {
        if (!isMounted) return;
        setThemeId(storedThemeId);
      })
      .catch(() => undefined);

    const unsubscribe = subscribeThemePreference((nextThemeId) => {
      setThemeId(nextThemeId);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (isAndroid) {
    return (
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} tabColors={tabColors} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "transparent",
            borderTopWidth: 0,
            elevation: 0,
            height: ANDROID_GLASS_TAB_HEIGHT + 20,
          },
        }}
      >
        <Tabs.Screen name="home" options={{ title: "Home" }} />
        <Tabs.Screen name="card" options={{ title: "Card" }} />
        <Tabs.Screen name="scanner" options={{ title: "Scan" }} />
        <Tabs.Screen name="camera-view" options={{ href: null }} />
        <Tabs.Screen name="supermarkets" options={{ title: "Map" }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="index" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <NativeTabs
      backBehavior={isAndroid ? "history" : undefined}
      labelVisibilityMode={isAndroid ? "labeled" : undefined}
      backgroundColor={isAndroid ? "#F5F8FB" : undefined}
      tintColor={tabColors.active}
      iconColor={{
        default: tabColors.inactive,
        selected: tabColors.active,
      }}
      labelStyle={{
        default: {
          fontSize: 11,
          fontWeight: "600",
          color: tabColors.inactive,
        },
        selected: {
          fontSize: 11,
          fontWeight: "700",
          color: tabColors.active,
        },
      }}
      indicatorColor={isAndroid ? tabColors.indicator : undefined}
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="home"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="home"
              />
            ),
          }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="card">
        <NativeTabs.Trigger.Icon
          sf={{ default: "creditcard", selected: "creditcard.fill" }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="credit-card"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="credit-card"
              />
            ),
          }}
        />
        <NativeTabs.Trigger.Label>Card</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scanner">
        <NativeTabs.Trigger.Icon
          sf="qrcode.viewfinder"
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="qr-code-scanner"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="qr-code-scanner"
              />
            ),
          }}
        />
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="supermarkets">
        <NativeTabs.Trigger.Icon
          sf={{ default: "map", selected: "map.fill" }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="map"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialIcons}
                name="map"
              />
            ),
          }}
        />
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
