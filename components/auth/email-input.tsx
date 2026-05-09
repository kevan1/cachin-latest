import {
  TextInput,
  StyleSheet,
  View,
  TextInputProps,
} from "react-native";

interface EmailInputProps extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  error?: boolean;
}

export const EmailInput: React.FC<EmailInputProps> = ({
  value,
  onChangeText,
  error = false,
  ...props
}) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder="Enter your email"
        placeholderTextColor="rgba(0,0,0,0.30)"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.44)",
    borderRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    fontSize: 18,
    paddingVertical: process.env.EXPO_OS === "ios" ? 14 : 10,
    color: "rgba(0,0,0,0.72)",
    backgroundColor: "rgba(255,255,255,0.42)",
    fontWeight: "700",
  },
  inputError: {
    borderColor: "#ef4444",
  },
});

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
