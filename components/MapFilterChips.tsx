import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";

interface FilterChipProps {
  label: string;
  icon?: string;
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
            {/* Using a simple text or view for icon placeholder if not using IconSymbol/SymbolView directly for custom icons */}
            {/* For this specific design, we can use simple icons */}
           {Platform.OS === 'ios' ? (
                // @ts-ignore
               <SymbolView name={icon} size={14} tintColor={active ? "#FFF" : "#000"} />
           ) : (
                // @ts-ignore
               <IconSymbol name={icon} size={14} color={active ? "#FFF" : "#000"} />
           )}
        </View>
      )}
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
      {hasDropdown && (
         <View style={{marginLeft: 4}}>
             {Platform.OS === 'ios' ? (
                 <SymbolView name="chevron.down" size={10} tintColor={active ? "#FFF" : "#000"} />
             ) : (
                 <IconSymbol name="arrow.down" size={10} color={active ? "#FFF" : "#000"} />
             )}
         </View>
      )}
    </TouchableOpacity>
  );
};

export const MapFilterChips: React.FC = () => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      <TouchableOpacity style={styles.filterButton}>
         {Platform.OS === 'ios' ? (
             <SymbolView name="slider.horizontal.3" size={18} tintColor="#000" />
         ) : (
             <IconSymbol name="chevron.right" size={18} color="#000" />
         )}
      </TouchableOpacity>
      
      <FilterChip label="Ordenar" hasDropdown onPress={() => {}} />
      <FilterChip label="Categorías" hasDropdown onPress={() => {}} />
      <FilterChip label="Barrios" hasDropdown onPress={() => {}} />
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
    alignItems: 'center',
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
  }
});
