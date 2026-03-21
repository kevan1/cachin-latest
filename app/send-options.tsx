import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function SendOptionsScreen() {
  const router = useRouter();
  const isIOS = process.env.EXPO_OS === "ios";

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (isIOS) {
      void Haptics.impactAsync(style);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: 28,
        gap: 16,
      }}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderCurve: "continuous",
            backgroundColor: "#DBEAFE",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol name="paperplane.fill" size={26} color="#2563EB" />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>
          Choose how you want to send money
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/send-amount");
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: "#E0F2FE",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSymbol name="person.crop.circle" size={22} color="#2563EB" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                Send to username
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                Send to a Cachin username or SNS
              </Text>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={22} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/send-link");
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: "#CCFBF1",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSymbol name="link" size={22} color="#0F766E" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                Create payment link
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                Share a link that anyone can claim
              </Text>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
