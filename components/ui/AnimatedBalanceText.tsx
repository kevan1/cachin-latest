import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { AnimatedRollingNumber } from "react-native-animated-rolling-numbers";

type AnimatedBalanceTextProps = {
  value: string;
  animatedValue?: number;
  animationTrigger?: number;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

function extractNumberMetadata(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/,/g, "");
  const prefix = normalized.match(/^[^\d+-]+/)?.[0] ?? "";
  const decimalPlaces = normalized.match(/\.(\d+)/)?.[1]?.length ?? 0;
  const numeric = Number.parseFloat(normalized.replace(/[^\d.+-]/g, ""));

  return { prefix, decimalPlaces, numeric };
}

export function AnimatedBalanceText({
  value,
  animatedValue,
  animationTrigger,
  containerStyle,
  textStyle,
}: AnimatedBalanceTextProps) {
  const flattenedTextStyle = useMemo(() => StyleSheet.flatten(textStyle), [textStyle]);
  const { prefix, decimalPlaces, numeric } = useMemo(() => extractNumberMetadata(value), [value]);

  const resolvedValue = useMemo(() => {
    if (typeof animatedValue === "number" && Number.isFinite(animatedValue)) {
      return animatedValue;
    }
    return numeric;
  }, [animatedValue, numeric]);
  const rollingRenderKey = useMemo(
    () => `rolling-${animationTrigger ?? 0}`,
    [animationTrigger]
  );

  if (!Number.isFinite(resolvedValue)) {
    return (
      <View style={containerStyle}>
        <Text style={flattenedTextStyle}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={styles.row}>
        {prefix ? <Text style={[flattenedTextStyle, styles.prefix]}>{prefix}</Text> : null}
        <AnimatedRollingNumber
          key={rollingRenderKey}
          value={resolvedValue}
          toFixed={decimalPlaces}
          useGrouping
          textStyle={flattenedTextStyle}
          spinningAnimationConfig={{ duration: 520 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  prefix: {
    marginRight: 2,
  },
});
