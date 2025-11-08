import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 3,
          borderTopColor: '#000000',
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#666666',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer,
              focused && styles.iconContainerActive
            ]}>
              <IconSymbol size={28} name="house.fill" color={focused ? '#000000' : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "",
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.scanButton}>
              <IconSymbol size={32} name="qrcode" color="#000000" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="supermarkets"
        options={{
          title: "Shops",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer,
              focused && styles.iconContainerActive
            ]}>
              <IconSymbol size={28} name="cart.fill" color={focused ? '#000000' : color} />
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
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    // You can add additional active styles here if needed
  },
  scanButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#60A5FA',
    borderWidth: 3,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
  },
});
