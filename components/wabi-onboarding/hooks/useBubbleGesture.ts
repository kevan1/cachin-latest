import {
  Gesture,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
} from "react-native-gesture-handler";
import {
  clamp,
  SharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  SPRING_FOLLOW_PROPS,
  SPRING_SNAP_PROPS,
  SPRING_TEXT_PROPS,
} from "../constants";

type UseBubbleGestureParams = {
  bubbleYPos: SharedValue<number>;
  bubbleXPos: SharedValue<number>;
  textMainYPos: SharedValue<number>;
  startY: SharedValue<number>;
  bubbleAtCenter: SharedValue<boolean>;
  bubbleInteractionProgress: SharedValue<number>;
  canvasWidth: number;
  centerY: number;
  bottomY: number;
  centerTextY: number;
  bottomTextY: number;
};

export function useBubbleGesture({
  bubbleYPos,
  bubbleXPos,
  textMainYPos,
  startY,
  bubbleAtCenter,
  bubbleInteractionProgress,
  canvasWidth,
  centerY,
  bottomY,
  centerTextY,
  bottomTextY,
}: UseBubbleGestureParams) {
  const onBegin = () => {
    "worklet";
    startY.value = bubbleYPos.value;
    bubbleInteractionProgress.value = withTiming(1, { duration: 120 });
  };

  const onUpdate = (e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
    "worklet";
    bubbleInteractionProgress.value = 1;
    const targetY = clamp(startY.value + e.translationY, 0, bottomY);
    const targetX = canvasWidth / 2 + e.translationX;
    bubbleYPos.value = withSpring(targetY, SPRING_FOLLOW_PROPS);
    bubbleXPos.value = withSpring(targetX, SPRING_FOLLOW_PROPS);
    textMainYPos.value = clamp(
      startY.value + e.translationY,
      centerTextY,
      bottomTextY
    );
  };

  const onEnd = () => {
    "worklet";
    const halfway = (centerY + bottomY) / 2;
    const snapTo = bubbleYPos.value < halfway ? centerY : bottomY;
    const snapTextTo = textMainYPos.value < halfway ? centerTextY : bottomTextY;
    bubbleYPos.value = withSpring(snapTo, SPRING_SNAP_PROPS);
    bubbleXPos.value = withSpring(canvasWidth / 2, SPRING_SNAP_PROPS);
    bubbleAtCenter.value = snapTo === centerY;
    textMainYPos.value = withSpring(snapTextTo, SPRING_TEXT_PROPS);
  };

  const onFinalize = () => {
    "worklet";
    bubbleInteractionProgress.value = withTiming(0, { duration: 420 });
  };

  return Gesture.Pan()
    .onBegin(onBegin)
    .onUpdate(onUpdate)
    .onEnd(onEnd)
    .onFinalize(onFinalize);
}
