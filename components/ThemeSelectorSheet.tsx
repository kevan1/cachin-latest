
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Dimensions, Platform, ScrollView, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { THEMES, MESH_POINTS } from '@/constants/themes';
import { MeshGradientView } from "@wilmxre/react-native-mesh-gradient/src";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.55;
const CARD_HEIGHT = CARD_WIDTH * 1.8;
const SPACING = 20;

interface ThemeSelectorSheetProps {
  isVisible: boolean;
  onClose: () => void;
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  toggleThemeMode: () => void; // For light/dark mode
}

export function ThemeSelectorSheet({ 
  isVisible, 
  onClose, 
  currentThemeId, 
  onSelectTheme,
  toggleThemeMode 
}: ThemeSelectorSheetProps) {
  const colorScheme = useColorScheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(100);

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 15 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(100, { duration: 200 });
    }
  }, [isVisible, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

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

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            snapToInterval={CARD_WIDTH + SPACING}
            decelerationRate="fast"
          >
            {THEMES.map((theme) => {
              const isActive = currentThemeId === theme.id;
              const colors = colorScheme === 'dark' ? theme.colors.dark : theme.colors.light;
              
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
                    isActive && styles.activeCardContainer
                  ]}
                >
                  <View style={styles.card}>
                    {Platform.OS === 'ios' ? (
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

          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={toggleThemeMode}>
              <View style={styles.footerIconCircle}>
                <IconSymbol name="circle.lefthalf.filled" size={20} color="#000" />
              </View>
              <Text style={styles.footerLabel}>Mode</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.footerButton}>
              <View style={styles.footerIconCircle}>
                <IconSymbol name="paintpalette.fill" size={20} color="#000" />
              </View>
              <Text style={styles.footerLabel}>Theme</Text>
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
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.225, // Center the first card
    paddingVertical: 40,
    alignItems: 'center',
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    paddingBottom: 50,
  },
  footerButton: {
    alignItems: 'center',
    gap: 8,
  },
  footerIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  }
});
