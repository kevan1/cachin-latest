import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";

const earnActions = [
  {
    title: "Spend with Cachin Card",
    subtitle: "Earn up to 1.5% back as tokenized gold.",
    icon: "credit-card",
  },
  {
    title: "Invite a friend",
    subtitle: "Get a launch bonus when they complete their first transfer.",
    icon: "person-add-alt-1",
  },
  {
    title: "Pay merchants",
    subtitle: "Boost rewards at participating local stores.",
    icon: "storefront",
  },
] as const;

const activityPreview = [
  { title: "Card cashback", amount: "+0.006 ORO", status: "Pending" },
  { title: "Invite bonus", amount: "+0.025 ORO", status: "Ready" },
] as const;

export default function EarnOroScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const goldText = isDark ? "#FFF4C2" : "#1F1600";
  const goldMuted = isDark ? "rgba(255,244,194,0.72)" : "rgba(31,22,0,0.72)";
  const goldSoft = isDark ? "rgba(255,244,194,0.62)" : "rgba(31,22,0,0.62)";
  const goldAccentText = isDark ? "#F8C846" : "#7A4E00";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={
          isDark
            ? ["#16110A", "#070707", "#050505"]
            : ["#FFF4C7", "#FFFFFF", "#F8FAFC"]
        }
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButtonPressable}
          onPress={() => router.back()}
          activeOpacity={0.78}
        >
          <GlassView
            style={[
              styles.iconButton,
              {
                borderColor: isDark
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(255,255,255,0.58)",
              },
            ]}
            intensity={26}
            interactive
          >
            <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
          </GlassView>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>
          Earn ORO
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <GlassView style={styles.heroCard} intensity={34} interactive>
        <View style={styles.heroTopRow}>
          <View style={styles.goldMark}>
            <MaterialIcons name="workspace-premium" size={28} color="#3B2A00" />
          </View>
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: goldAccentText }]}>
              Prototype
            </Text>
          </View>
        </View>

        <Text style={[styles.eyebrow, { color: goldAccentText }]}>
          Gold-tokenized cashback
        </Text>
        <Text style={[styles.heroTitle, { color: goldText }]}>
          Turn everyday rewards into ORO.
        </Text>
        <Text style={[styles.heroCopy, { color: goldMuted }]}>
          Earn cashback points that settle into gold-backed ORO tokens once
          rewards clear.
        </Text>

        <View style={styles.balanceRow}>
          <View>
            <Text style={[styles.balanceLabel, { color: goldSoft }]}>
              Projected rewards
            </Text>
            <Text style={[styles.balanceValue, { color: goldText }]}>
              0.031 ORO
            </Text>
          </View>
          <View style={styles.goldValueCard}>
            <Text style={[styles.goldValueLabel, { color: goldSoft }]}>
              Gold value
            </Text>
            <Text style={[styles.goldValue, { color: goldText }]}>$2.18</Text>
          </View>
        </View>
      </GlassView>

      <View style={styles.metricGrid}>
        <GlassView style={styles.metricCard} intensity={24} interactive>
          <Text style={[styles.metricLabel, { color: goldSoft }]}>
            Cashback rate
          </Text>
          <Text style={[styles.metricValue, { color: goldText }]}>1.5%</Text>
        </GlassView>
        <GlassView style={styles.metricCard} intensity={24} interactive>
          <Text style={[styles.metricLabel, { color: goldSoft }]}>Settlement</Text>
          <Text style={[styles.metricValue, { color: goldText }]}>T+1</Text>
        </GlassView>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.primaryText }]}>
          Ways to earn
        </Text>
      </View>

      <View style={styles.actionList}>
        {earnActions.map((action) => (
          <TouchableOpacity key={action.title} activeOpacity={0.82}>
            <GlassView style={styles.actionCard} intensity={28} interactive>
              <View style={styles.actionIcon}>
                <MaterialIcons name={action.icon} size={22} color="#7A4E00" />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: palette.primaryText }]}>
                  {action.title}
                </Text>
                <Text style={[styles.actionSubtitle, { color: palette.secondaryText }]}>
                  {action.subtitle}
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={palette.secondaryText}
              />
            </GlassView>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.primaryText }]}>
          Reward activity
        </Text>
      </View>

      <GlassView style={styles.activityCard} intensity={26} interactive>
        {activityPreview.map((item, index) => (
          <View
            key={item.title}
            style={[
              styles.activityRow,
              index < activityPreview.length - 1 ? styles.activityDivider : null,
            ]}
          >
            <View>
              <Text style={[styles.activityTitle, { color: palette.primaryText }]}>
                {item.title}
              </Text>
              <Text style={[styles.activityStatus, { color: palette.secondaryText }]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.activityAmount}>{item.amount}</Text>
          </View>
        ))}
      </GlassView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
  },
  heroCard: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
  },
  goldMark: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8C846",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(248,200,70,0.2)",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: 10,
  },
  heroCopy: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 24,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  goldValueCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  goldValueLabel: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
  },
  goldValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  metricGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  actionList: {
    gap: 10,
  },
  actionCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.44)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,200,70,0.22)",
  },
  actionText: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  actionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  activityCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.44)",
  },
  activityRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(122,78,0,0.14)",
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
  },
  activityStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
  activityAmount: {
    color: "#128A3A",
    fontSize: 15,
    fontWeight: "900",
  },
});
