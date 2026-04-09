import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function SendOptionsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const isIOS = process.env.EXPO_OS === "ios";

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (isIOS) {
      void Haptics.impactAsync(style);
    }
  };

  const handleBack = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.containerContent}
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButtonPressable}
          onPress={handleBack}
          activeOpacity={0.78}
        >
          <GlassView
            style={[
              styles.iconButton,
              {
                borderColor:
                  colorScheme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
              },
            ]}
            intensity={26}
            interactive
          >
            <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
          </GlassView>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Send</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.heroIcon, { backgroundColor: palette.success }]}>
        <IconSymbol name="paperplane.fill" size={24} color={palette.actionPrimaryText} />
      </View>

      <Text style={[styles.subtitle, { color: palette.secondaryText }]} selectable>
        Choose how you want to send money
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/send-amount");
          }}
          activeOpacity={0.8}
          style={styles.optionPressable}
        >
          <GlassView
            style={[
              styles.optionCard,
              {
                borderColor:
                  colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.52)",
              },
            ]}
            intensity={30}
            interactive
          >
            <View style={styles.optionLeft}>
              <GlassView style={styles.iconCircle} intensity={24} interactive>
                <IconSymbol name="person.crop.circle" size={22} color="#2563EB" />
              </GlassView>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: palette.primaryText }]} selectable>
                  Send to username
                </Text>
                <Text style={[styles.optionSubtitle, { color: palette.secondaryText }]} selectable>
                  Send to a Cachin username or SNS
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={22} color={palette.secondaryText} />
          </GlassView>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/send-link");
          }}
          activeOpacity={0.8}
          style={styles.optionPressable}
        >
          <GlassView
            style={[
              styles.optionCard,
              {
                borderColor:
                  colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.52)",
              },
            ]}
            intensity={30}
            interactive
          >
            <View style={styles.optionLeft}>
              <GlassView style={styles.iconCircle} intensity={24} interactive>
                <IconSymbol name="link" size={22} color="#0F766E" />
              </GlassView>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: palette.primaryText }]} selectable>
                  Create payment link
                </Text>
                <Text style={[styles.optionSubtitle, { color: palette.secondaryText }]} selectable>
                  Share a link that anyone can claim
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={22} color={palette.secondaryText} />
          </GlassView>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  containerContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 28,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 12,
  },
  iconButtonPressable: {
    borderRadius: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: -6,
  },
  optionsContainer: {
    gap: 12,
  },
  optionPressable: {
    borderRadius: 16,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
