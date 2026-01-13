import { useState } from "react";
import { Button, Text } from "react-native";

import { useLoginWithPasskey, useSignupWithPasskey } from "@privy-io/expo/passkey";

export default function PasskeyLogin() {
  const [error, setError] = useState("");
  
  const { loginWithPasskey } = useLoginWithPasskey({
    onError: (err) => {
      console.log('Login error:', JSON.stringify(err, null, 2));
      // Handle NoCredentials error by prompting to register
      if (err.message?.includes('NoCredentials') || err.message?.includes('No credentials')) {
        setError("No passkey found. Please register a passkey first.");
      } else {
        setError(JSON.stringify(err.message));
      }
    },
  });

  const { signupWithPasskey } = useSignupWithPasskey({
    onSuccess: () => {
      console.log("Passkey registered and logged in successfully");
      setError("");
    },
    onError: (err) => {
      console.log('Signup error:', JSON.stringify(err, null, 2));
      setError(JSON.stringify(err.message));
    },
  });

  const handlePasskeyAuth = async () => {
    setError("");
    try {
      await loginWithPasskey({
        relyingParty: "https://auth.kevan.ar",
      });
    } catch (err: any) {
      console.log("Login failed:", err);
    }
  };

  const handleRegisterPasskey = () => {
    setError("");
    signupWithPasskey({
      relyingParty: "https://auth.kevan.ar",
    });
  };

  return (
    <>
      <Button
        title="Register Passkey"
        onPress={handleRegisterPasskey}
      />
      <Button
        title="Login using Passkey"
        onPress={handlePasskeyAuth}
      />
      {error && <Text style={{ color: "red" }}>Error: {error}</Text>}
    </>
  );
}
