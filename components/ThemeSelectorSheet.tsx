
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, useWindowDimensions, ScrollView, Modal, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { THEMES, MESH_POINTS } from '@/constants/themes';
import { MeshGradientView } from "@wilmxre/react-native-mesh-gradient/src";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const SPACING = 20;

interface ThemeSelectorSheetProps {
  isVisible: boolean;
  onClose: () => void;
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  toggleThemeMode: () => void; // For light/dark mode - we might replace this with selectMode
}

type EditMode = 'style' | 'mode';
type ThemeCategory = 'glow' | 'mono';
type AppearanceMode = 'light' | 'dark' | 'system';

export function ThemeSelectorSheet({ 
  isVisible, 
  onClose, 
  currentThemeId, 
  onSelectTheme,
  toggleThemeMode // We'll keep this for compatibility but implement our own logic
}: ThemeSelectorSheetProps) {
  const systemColorScheme = useColorScheme();
  const [activeCategory, setActiveCategory] = useState<ThemeCategory>('glow');
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>('system');
  const [editMode, setEditMode] = useState<EditMode>('style'); // 'style' or 'mode'
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth * 0.55;
  const cardHeight = cardWidth * 1.8;
  const scrollSidePadding = screenWidth * 0.225;
  const supportsMeshGradient = Platform.OS === 'ios' && Number(Platform.Version) >= 16;
  
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(100);

  // Sync initial state when visible
  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 15 });
      
      // Determine category from current theme
      const current = THEMES.find(t => t.id === currentThemeId);
      if (current) {
        setActiveCategory(current.category as ThemeCategory);
      }
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(100, { duration: 200 });
    }
  }, [isVisible, currentThemeId, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  const filteredThemes = useMemo(() => {
    return THEMES.filter(t => t.category === activeCategory);
  }, [activeCategory]);
  
  // Determine effective color scheme based on selection
  const effectiveColorScheme = appearanceMode === 'system' ? systemColorScheme : appearanceMode;

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Logic to reset? For now maybe just close or reset to defaults
    // onClose();
  };

  if (!isVisible) return null;

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>

        {/* Modal Content */}
        <Animated.View style={[styles.container, animatedStyle]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={16} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>Theme preview</Text>
            <View style={{ width: 40 }} /> 
          </View>

          {/* Cards Area */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal: scrollSidePadding }]}
            snapToInterval={cardWidth + SPACING}
            decelerationRate="fast"
          >
            {filteredThemes.map((theme) => {
              const isActive = currentThemeId === theme.id;
              // Use the effective color scheme for preview
              const colors = effectiveColorScheme === 'dark' ? theme.colors.dark : theme.colors.light;
              
              return (
                <TouchableOpacity 
                  key={theme.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectTheme(theme.id);
                  }}
                  activeOpacity={0.9}
                  style={[
                    styles.cardContainer,
                    { width: cardWidth, height: cardHeight },
                    isActive && styles.activeCardContainer
                  ]}
                >
                  <View style={styles.card}>
                    {supportsMeshGradient ? (
                       <MeshGradientView
                         meshWidth={3}
                         meshHeight={3}
                         points={MESH_POINTS}
                         primaryColors={colors.primary}
                         secondaryColors={colors.secondary}
                         background={colors.background}
                         smoothsColors={true}
                         style={StyleSheet.absoluteFill}
                         pointerEvents="none"
                       />
                    ) : (
                      <LinearGradient
                        colors={[colors.primary[0], colors.primary[4], colors.primary[8]]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    
                    <View style={styles.cardContent}>
                      <View style={styles.topDots}>
                        <View style={styles.dot} />
                        <View style={styles.pill} />
                        <View style={styles.dot} />
                      </View>
                      
                      <View style={styles.centerContent}>
                        <Text style={styles.cardTitle}>{theme.name} · {theme.currency}</Text>
                        <View style={styles.iconCircle}>
                          <IconSymbol name="photo" size={20} color="#FFF" />
                        </View>
                      </View>
                      
                      <View style={styles.bottomDots}>
                         <View style={styles.bottomDot} />
                         <View style={styles.bottomDot} />
                         <View style={styles.bottomDot} />
                         <View style={styles.bottomDot} />
                      </View>
                      
                      <View style={styles.cardFooter} />
                    </View>
                  </View>
                  
                  {isActive && (
                    <View style={styles.activeIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Controls Area */}
          <View style={styles.controlsContainer}>
            {/* Mode Switcher (Hidden but implied by navigation? Or explicit buttons?) 
                User requested: "selection of the current type of themes" vs "selection is the mode"
                We'll use icons to switch context
            */}
            
            <View style={styles.optionsRow}>
              {editMode === 'style' ? (
                <>
                  <TouchableOpacity 
                    style={styles.optionItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveCategory('glow');
                      // Also select the first theme in this category if current is not in it?
                      // keeping simple for now
                    }}
                  >
                    <View style={[styles.circleOption, activeCategory === 'glow' && styles.activeCircleOption]}>
                      <LinearGradient
                        colors={['#00C2FF', '#7C3AED']}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <Text style={[styles.optionLabel, activeCategory === 'glow' && styles.activeOptionLabel]}>Glow</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.optionItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveCategory('mono');
                    }}
                  >
                    <View style={[styles.circleOption, activeCategory === 'mono' && styles.activeCircleOption]}>
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#333' }]} />
                    </View>
                    <Text style={[styles.optionLabel, activeCategory === 'mono' && styles.activeOptionLabel]}>Minimal</Text>
                  </TouchableOpacity>
                  
                  {/* Locked / Future Options */}
                  <TouchableOpacity style={[styles.optionItem, { opacity: 0.5 }]} disabled>
                     <View style={styles.circleOption}>
                        <LinearGradient colors={['#FFD700', '#FFA500']} style={StyleSheet.absoluteFill} />
                        <View style={styles.lockIcon}><IconSymbol name="lock.fill" size={12} color="#FFF"/></View>
                     </View>
                     <Text style={styles.optionLabel}>Premium</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.optionItem, { opacity: 0.5 }]} disabled>
                     <View style={styles.circleOption}>
                        <LinearGradient colors={['#A0A0A0', '#404040']} style={StyleSheet.absoluteFill} />
                        <View style={styles.lockIcon}><IconSymbol name="lock.fill" size={12} color="#FFF"/></View>
                     </View>
                     <Text style={styles.optionLabel}>Metal</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.optionItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAppearanceMode('light');
                      // In a real app we'd toggle the system theme here
                    }}
                  >
                    <View style={[styles.circleOption, appearanceMode === 'light' && styles.activeCircleOption, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5E5' }]}>
                    </View>
                    <Text style={[styles.optionLabel, appearanceMode === 'light' && styles.activeOptionLabel]}>Light</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.optionItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAppearanceMode('dark');
                    }}
                  >
                    <View style={[styles.circleOption, appearanceMode === 'dark' && styles.activeCircleOption, { backgroundColor: '#000' }]}>
                    </View>
                    <Text style={[styles.optionLabel, appearanceMode === 'dark' && styles.activeOptionLabel]}>Dark</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.optionItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAppearanceMode('system');
                    }}
                  >
                    <View style={[styles.circleOption, appearanceMode === 'system' && styles.activeCircleOption, { overflow: 'hidden' }]}>
                       <View style={{flexDirection: 'row', flex: 1}}>
                         <View style={{flex: 1, backgroundColor: '#FFF'}} />
                         <View style={{flex: 1, backgroundColor: '#000'}} />
                       </View>
                    </View>
                    <Text style={[styles.optionLabel, appearanceMode === 'system' && styles.activeOptionLabel]}>System</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Navigation / Undo / Apply Row */}
            <View style={styles.bottomNavRow}>
               <TouchableOpacity 
                  style={styles.undoButton} 
                  onPress={() => {
                     // Toggle between modes for "Back" behavior? Or implement undo?
                     // Let's use it to toggle back to 'style' if in 'mode', or just visual
                     if (editMode === 'mode') {
                       Haptics.selectionAsync();
                       setEditMode('style');
                     } else {
                       handleReset();
                     }
                  }}
               >
                 <IconSymbol name="arrow.uturn.backward" size={20} color="#000" />
               </TouchableOpacity>
               
               {/* Mode Toggles (Small) */}
               <View style={styles.togglePill}>
                 <TouchableOpacity 
                   style={[styles.toggleSegment, editMode === 'style' && styles.activeToggleSegment]}
                   onPress={() => {
                     Haptics.selectionAsync();
                     setEditMode('style');
                   }}
                 >
                   <IconSymbol name="paintpalette.fill" size={16} color={editMode === 'style' ? "#FFF" : "#000"} />
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.toggleSegment, editMode === 'mode' && styles.activeToggleSegment]}
                   onPress={() => {
                     Haptics.selectionAsync();
                     setEditMode('mode');
                   }}
                 >
                   <IconSymbol name="circle.lefthalf.filled" size={16} color={editMode === 'mode' ? "#FFF" : "#000"} />
                 </TouchableOpacity>
               </View>

               <View style={{ width: 40 }} /> 
            </View>

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '92%',
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderCurve: 'continuous',
    zIndex: 101,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  cardContainer: {
    marginHorizontal: SPACING / 2,
    alignItems: 'center',
  },
  activeCardContainer: {
    transform: [{ scale: 1.05 }],
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  topDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    opacity: 0.5,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pill: {
    width: 60,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  centerContent: {
    alignItems: 'center',
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  bottomDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  cardFooter: {
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    marginHorizontal: -5,
    marginBottom: -5,
  },
  activeIndicator: {
    marginTop: 15,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000',
  },
  controlsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    height: 90,
  },
  optionItem: {
    alignItems: 'center',
    gap: 8,
  },
  circleOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCircleOption: {
    borderWidth: 2,
    borderColor: '#007AFF', // Or theme color
    transform: [{scale: 1.1}]
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeOptionLabel: {
    color: '#000',
    fontWeight: '700',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 4,
    borderTopLeftRadius: 8,
  },
  bottomNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  undoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 20,
    padding: 4,
    gap: 4,
  },
  toggleSegment: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeToggleSegment: {
    backgroundColor: '#000',
  },
  applyButton: {
    backgroundColor: '#E5E5EA', 
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000', // Better contrast on light gray
  }
});
