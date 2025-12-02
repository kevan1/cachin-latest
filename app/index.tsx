import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useLoginWithPasskey } from "@privy-io/expo/passkey";

// Decorative element configuration
const decorations = [
  { key: 'coin1', image: true, top: 60, left: 30, from: { x: -100, y: -100 }, delay: 0, size: 32 },
  { key: 'coin2', image: true, top: 50, right: 50, from: { x: 100, y: -100 }, delay: 100, size: 32 },
  { key: 'coin3', image: true, top: 100, left: 20, from: { x: -150, y: -50 }, delay: 200, size: 28 },
  { key: 'circle1', shape: true, top: 150, right: 30, fontSize: 40, color: '#93C5FD', from: { x: 150, y: -80 }, delay: 300 },
  { key: 'coin4', image: true, top: 180, left: 70, from: { x: -120, y: 0 }, delay: 400, size: 30 },
  { key: 'coin5', image: true, top: 200, right: 80, from: { x: 120, y: -50 }, delay: 500, size: 32 },
  { key: 'circle2', shape: true, top: 220, left: 120, fontSize: 32, color: '#FDE68A', from: { x: -100, y: 50 }, delay: 600 },
  { key: 'coin6', image: true, top: 280, right: 40, from: { x: 150, y: 0 }, delay: 700, size: 34 },
  { key: 'circle3', shape: true, top: 300, left: 40, fontSize: 24, color: '#BFDBFE', from: { x: -130, y: 100 }, delay: 800 },
  { key: 'coin7', image: true, top: 340, right: 90, from: { x: 140, y: 80 }, delay: 900, size: 30 },
  { key: 'circle4', shape: true, top: 360, left: 80, fontSize: 28, color: '#FED7AA', from: { x: -110, y: 150 }, delay: 1000 },
  { key: 'coin8', image: true, top: 420, left: 50, from: { x: -140, y: 200 }, delay: 1100, size: 32 },
  { key: 'coin9', image: true, top: 440, right: 60, from: { x: 130, y: 180 }, delay: 1200, size: 28 },
  { key: 'circle5', shape: true, top: 480, left: 30, fontSize: 36, color: '#86EFAC', from: { x: -120, y: 250 }, delay: 1300 },
  { key: 'circle6', shape: true, top: 500, right: 40, fontSize: 30, color: '#FCA5A5', from: { x: 140, y: 250 }, delay: 1400 },
  { key: 'coin10', image: true, top: 540, left: 100, from: { x: -90, y: 300 }, delay: 1500, size: 32 },
  { key: 'circle7', shape: true, top: 560, right: 80, fontSize: 26, color: '#E9D5FF', from: { x: 120, y: 320 }, delay: 1600 },
  { key: 'circle8', shape: true, top: 600, left: 60, fontSize: 32, color: '#FED7AA', from: { x: -100, y: 350 }, delay: 1700 },
  { key: 'coin11', image: true, top: 620, right: 100, from: { x: 150, y: 380 }, delay: 1800, size: 32 },
  { key: 'circle9', shape: true, top: 660, left: 40, fontSize: 28, color: '#93C5FD', from: { x: -110, y: 420 }, delay: 1900 },
  { key: 'circle10', shape: true, top: 680, right: 50, fontSize: 24, color: '#FDE68A', from: { x: 130, y: 450 }, delay: 2000 },
];

function AnimatedDecoration({ item }: { item: any }) {
  const translateX = useRef(new Animated.Value(item.from.x)).current;
  const translateY = useRef(new Animated.Value(item.from.y)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fly in animation
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: item.shape ? 0.75 : 0.85,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }, item.delay);

    // Continuous floating animation
    const startFloating = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, item.delay + 800);

    return () => clearTimeout(startFloating);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const floatingTransform = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10 - Math.random() * 10],
  });

  const positionStyle: any = {
    position: 'absolute',
    top: item.top,
  };

  if ('left' in item) {
    positionStyle.left = item.left;
  } else {
    positionStyle.right = item.right;
  }

  if (item.image) {
    return (
      <Animated.View
        style={[
          positionStyle,
          {
            opacity,
            transform: [
              { translateX },
              { translateY },
              { translateY: floatingTransform },
            ],
          },
        ]}
      >
        <Image
          source={require('../assets/images/coin.gif')}
          style={{ width: item.size, height: item.size }}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  return (
    <Animated.Text
      style={[
        positionStyle,
        {
          fontSize: item.shape ? item.fontSize : 32,
          color: item.shape ? item.color : undefined,
          opacity,
          transform: [
            { translateX },
            { translateY },
            { translateY: floatingTransform },
          ],
        },
      ]}
    >
      {item.shape ? '●' : item.emoji}
    </Animated.Text>
  );
}

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const { loginWithPasskey } = useLoginWithPasskey({
    onError: (err) => {
      console.error('Login error:', err);
      setLoading(false);
    },
    onSuccess: () => {
      console.log('Login successful');
      setLoading(false);
      router.replace('/(main)');
    },
  });

  const handleRegister = () => {
    router.push("/username");
  };

  const handleLogin = async () => {
    setLoading(true);
    loginWithPasskey({
      relyingParty: "https://auth.kevan.ar",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Animated background decorations */}
      <View style={styles.bg} pointerEvents="none">
        {decorations.map((item) => (
          <AnimatedDecoration key={item.key} item={item} />
        ))}
      </View>

      <View style={styles.content}>
        <View style={styles.mascot}>
          <Image 
            source={require('../assets/images/logomark.png')} 
            style={styles.logomark}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Spend, more{"\n"}effortlessly</Text>
        <Text style={styles.subtitle}>
          Create a brand new wallet or add an existing one to get started easily.
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.9}
            style={styles.primary}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.primaryText}>Register</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.9}
            style={styles.secondary}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.secondaryText}>Log In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By using Family, you agree to accept our <Text style={styles.link}>Terms of Use</Text> and <Text style={styles.link}>Privacy Policy</Text>.
        </Text>
      </View>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  mascot: {
    position: "absolute",
    top: 140,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  logomark: {
    width: 240,
    height: 240,
  },
  title: {
    marginTop: 360,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
    marginBottom: 12,
  },
  subtitle: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  buttons: {
    width: "100%",
    gap: 14,
  },
  primary: {
    backgroundColor: "#10A5F5",
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  secondary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  legal: {
    marginTop: 18,
    marginBottom: 24,
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
  },
  link: {
    color: "#111827",
    textDecorationLine: "underline",
  },
});
