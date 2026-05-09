import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

type ProfileMenuRowProps = {
  title: string;
  subtitle?: string;
  iconName?: IconName;
  iconColors?: [string, string];
  onPress?: () => void;
  trailingText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  withDivider?: boolean;
  selected?: boolean;
};

export function ProfileMenuRow({
  title,
  subtitle,
  iconName,
  iconColors = ['#686B72', '#26282D'],
  onPress,
  trailingText,
  isLoading,
  disabled,
  withDivider,
  selected,
}: ProfileMenuRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={onPress && !disabled ? 0.82 : 1}
      onPress={disabled ? undefined : onPress}
      disabled={!onPress || disabled}
      style={[
        styles.row,
        iconName ? styles.rowWithIcon : styles.rowPlain,
        withDivider ? styles.rowDivider : null,
        disabled ? styles.rowDisabled : null,
      ]}
    >
      <View style={[styles.content, iconName ? styles.contentWithIcon : null]}>
        {iconName ? (
          <LinearGradient
            colors={iconColors}
            start={{ x: 0.15, y: 0.05 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.iconCircle}
          >
            <MaterialIcons name={iconName} size={19} color="#FFFFFF" />
          </LinearGradient>
        ) : null}
        <View style={styles.textBlock}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={styles.title}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.trailing}>
        {trailingText ? (
          <Text numberOfLines={1} style={styles.trailingText}>
            {trailingText}
          </Text>
        ) : null}
        {isLoading ? (
          <ActivityIndicator color="rgba(255,255,255,0.74)" />
        ) : onPress || selected ? (
          <MaterialIcons
            name={selected ? 'check' : 'chevron-right'}
            size={26}
            color={selected ? '#6DDC77' : 'rgba(255,255,255,0.74)'}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowPlain: {
    minHeight: 52,
    paddingVertical: 12,
  },
  rowWithIcon: {
    minHeight: 70,
    paddingLeft: 20,
    paddingVertical: 11,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  rowDisabled: {
    opacity: 0.58,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  contentWithIcon: {
    gap: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#F5F5F7',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.46)',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  trailingText: {
    maxWidth: 96,
    color: 'rgba(255,255,255,0.52)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
});
