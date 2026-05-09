import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

type GeneratedProfileAvatarProps = {
  size?: number;
  showOuterRing?: boolean;
};

export function GeneratedProfileAvatar({
  size = 68,
  showOuterRing = true,
}: GeneratedProfileAvatarProps) {
  const canvasSize = showOuterRing ? size + 28 : size + 8;
  const center = canvasSize / 2;
  const ringRadius = size / 2 + 11;
  const outerRadius = size / 2;
  const innerRadius = size * 0.34;

  return (
    <Svg width={canvasSize} height={canvasSize} viewBox={`0 0 ${canvasSize} ${canvasSize}`}>
      <Defs>
        <RadialGradient id="outerMetal" cx="35%" cy="24%" r="76%">
          <Stop offset="0" stopColor="#F5F5F5" stopOpacity="0.96" />
          <Stop offset="0.33" stopColor="#9B9B9B" stopOpacity="0.96" />
          <Stop offset="0.62" stopColor="#515151" stopOpacity="0.98" />
          <Stop offset="1" stopColor="#EDEDED" stopOpacity="0.94" />
        </RadialGradient>
        <RadialGradient id="innerMetal" cx="67%" cy="18%" r="82%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="0.22" stopColor="#D7D7D7" stopOpacity="0.98" />
          <Stop offset="0.54" stopColor="#5A5A5A" stopOpacity="1" />
          <Stop offset="1" stopColor="#141414" stopOpacity="1" />
        </RadialGradient>
        <LinearGradient id="slashLight" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.06" />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.78" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.06" />
        </LinearGradient>
        <LinearGradient id="lowerGlow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.52" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {showOuterRing ? (
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={2}
          strokeDasharray="6 7"
        />
      ) : null}
      <Circle
        cx={center}
        cy={center}
        r={outerRadius}
        fill="url(#outerMetal)"
        stroke="rgba(255,255,255,0.48)"
        strokeWidth={3}
      />
      <Circle cx={center} cy={center} r={innerRadius} fill="url(#innerMetal)" />
      <Ellipse
        cx={center}
        cy={center + outerRadius * 0.73}
        rx={outerRadius * 0.58}
        ry={outerRadius * 0.18}
        fill="url(#lowerGlow)"
      />
      <G rotation={32} origin={`${center}, ${center}`}>
        <Path
          d={`M ${center - outerRadius * 0.12} ${center - outerRadius * 0.82}
              Q ${center + outerRadius * 0.22} ${center - outerRadius * 0.82}
                ${center + outerRadius * 0.18} ${center - outerRadius * 0.48}
              L ${center - outerRadius * 0.12} ${center + outerRadius * 0.36}
              Q ${center - outerRadius * 0.18} ${center + outerRadius * 0.58}
                ${center - outerRadius * 0.42} ${center + outerRadius * 0.50}
              Q ${center - outerRadius * 0.58} ${center + outerRadius * 0.42}
                ${center - outerRadius * 0.48} ${center + outerRadius * 0.18}
              Z`}
          fill="url(#slashLight)"
        />
      </G>
      <Path
        d={`M ${center - innerRadius * 0.5} ${center + innerRadius * 0.18}
            C ${center - innerRadius * 0.27} ${center + innerRadius * 0.78}
              ${center + innerRadius * 0.48} ${center + innerRadius * 0.78}
              ${center + innerRadius * 0.66} ${center + innerRadius * 0.18}`}
        fill="none"
        stroke="rgba(15,15,15,0.78)"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}
