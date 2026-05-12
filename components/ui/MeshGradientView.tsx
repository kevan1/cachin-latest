import {
  Platform,
  UIManager,
  requireNativeComponent,
  type ViewProps,
} from "react-native";

const LINKING_ERROR =
  "The package '@wilmxre/react-native-mesh-gradient' does not seem to be linked. Make sure:\n\n" +
  Platform.select({ ios: "- You have run 'pod install'\n", default: "" }) +
  "- You rebuilt the app after installing the package\n" +
  "- You are not using Expo Go\n";

export type MeshGradientViewProps = ViewProps & {
  meshWidth: number;
  meshHeight: number;
  points: number[][];
  primaryColors: string[];
  secondaryColors?: string[];
  background?: string;
  smoothsColors?: boolean;
  colorSpace?: "device" | "perceptual";
  isAnimated?: boolean;
  borderRadius?: number;
  animationDuration?: number;
  animationType?: "sine" | "easeInOut" | "linear";
};

const ComponentName = "MeshGradientView";

export const MeshGradientView =
  UIManager.getViewManagerConfig(ComponentName) != null
    ? requireNativeComponent<MeshGradientViewProps>(ComponentName)
    : () => {
        throw new Error(LINKING_ERROR);
      };
