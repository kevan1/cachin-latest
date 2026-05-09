import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type Rail = "p2p" | "manteca";

export default function QrRailSelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];

  const amount = firstParam(params.amount);
  const paymentAddress = firstParam(params.paymentAddress);
  const rawQr = firstParam(params.rawQr);

  const chooseRail = (rail: Rail) => {
    const nextParams = {
      method: "mercadopago",
      currency: "ARS",
      amount,
      paymentAddress,
      rawQr,
      rail,
    };

    if (amount) {
      router.push({
        pathname: "/withdraw-bank",
        params: nextParams,
      });
      return;
    }

    router.push({
      pathname: "/withdraw-amount",
      params: nextParams,
    });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: "transparent" }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButtonPressable}
          onPress={() => router.back()}
          activeOpacity={0.78}
        >
          <GlassView style={styles.iconButton} intensity={26} interactive>
            <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
          </GlassView>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Choose rail</Text>
        <View style={styles.headerSpacer} />
      </View>

      <GlassView style={styles.qrCard} intensity={30} interactive>
        <Text style={[styles.label, { color: palette.secondaryText }]}>Scanned QR</Text>
        <Text style={[styles.address, { color: palette.primaryText }]} numberOfLines={2}>
          {paymentAddress || "ARS QR"}
        </Text>
        {amount ? (
          <Text style={[styles.amount, { color: palette.secondaryText }]}>ARS$ {amount}</Text>
        ) : null}
      </GlassView>

      <View style={styles.railList}>
        <TouchableOpacity activeOpacity={0.82} onPress={() => chooseRail("p2p")}>
          <GlassView style={styles.railButton} intensity={28} interactive>
            <View style={styles.railIcon}>
              <MaterialIcons name="swap-horiz" size={22} color={palette.primaryText} />
            </View>
            <View style={styles.railText}>
              <Text style={[styles.railTitle, { color: palette.primaryText }]}>P2P.me</Text>
              <Text style={[styles.railDescription, { color: palette.secondaryText }]}>
                Use the existing P2P ARS test flow.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={palette.secondaryText} />
          </GlassView>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.82} onPress={() => chooseRail("manteca")}>
          <GlassView style={styles.railButton} intensity={28} interactive>
            <View style={styles.railIcon}>
              <MaterialIcons name="qr-code-2" size={22} color={palette.primaryText} />
            </View>
            <View style={styles.railText}>
              <Text style={[styles.railTitle, { color: palette.primaryText }]}>Manteca</Text>
              <Text style={[styles.railDescription, { color: palette.secondaryText }]}>
                Use the separated QR 3.0 Manteca test path.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={palette.secondaryText} />
          </GlassView>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconButtonPressable: {
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
  },
  qrCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  address: {
    fontSize: 20,
    fontWeight: "700",
  },
  amount: {
    fontSize: 15,
    marginTop: 8,
  },
  railList: {
    gap: 12,
  },
  railButton: {
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  railIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  railText: {
    flex: 1,
  },
  railTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  railDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
