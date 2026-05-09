import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";

export type MerchantCategory = string;

type MapFilterChipsProps = {
  activeCategory: string | null;
  categories: string[];
  onCategoryPress: (category: string | null) => void;
};

interface FilterChipProps {
  label: string;
  icon?: IconSymbolName;
  active?: boolean;
  onPress?: () => void;
  hasDropdown?: boolean;
}

const FilterChip: React.FC<FilterChipProps> = ({
  label,
  icon,
  active,
  onPress,
  hasDropdown,
}) => {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.activeChip]}
      onPress={onPress}
    >
      {icon && (
        <View style={styles.iconContainer}>
          <IconSymbol name={icon} size={14} color={active ? "#FFF" : "#000"} />
        </View>
      )}
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
      {hasDropdown && (
        <View style={{ marginLeft: 4 }}>
          <IconSymbol
            name="chevron.down"
            size={14}
            color={active ? "#FFF" : "#000"}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

export const MapFilterChips: React.FC<MapFilterChipsProps> = ({
  activeCategory,
  categories,
  onCategoryPress,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.filterButton}
        onPress={() => onCategoryPress(null)}
      >
        <IconSymbol name="slider.horizontal.3" size={18} color="#000" />
      </TouchableOpacity>

      <FilterChip
        label="All"
        active={activeCategory === null}
        onPress={() => onCategoryPress(null)}
      />

      {categories.map((category) => {
        const isActive = activeCategory === category;
        return (
          <FilterChip
            key={category}
            label={category}
            active={isActive}
            onPress={() => onCategoryPress(isActive ? null : category)}
          />
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 50,
    marginBottom: 10,
  },
  container: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  activeChip: {
    backgroundColor: "#000",
  },
  iconContainer: {
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  activeLabel: {
    color: "#FFF",
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    borderCurve: "continuous",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
});
