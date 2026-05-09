declare module "@wilmxre/react-native-mesh-gradient/src" {
  import type { ComponentType } from "react";
  import type { StyleProp, ViewStyle } from "react-native";

  export type MeshGradientViewProps = {
    meshWidth: number;
    meshHeight: number;
    points: number[][];
    primaryColors: string[];
    secondaryColors?: string[];
    background?: string;
    smoothsColors?: boolean;
    colorSpace?: "device" | "perceptual";
    isAnimated?: boolean;
    animationDuration?: number;
    animationType?: "sine" | "linear";
    style?: StyleProp<ViewStyle>;
    pointerEvents?: ViewStyle["pointerEvents"];
  };

  export const MeshGradientView: ComponentType<MeshGradientViewProps>;
}
