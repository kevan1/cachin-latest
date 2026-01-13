import {
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
} from "@privy-io/expo";
import { View, Text, Button } from "react-native";

export default function Wallets() {
  const { create: createEthereumWallet } = useEmbeddedEthereumWallet();
  const { create: createSolanaWallet } = useEmbeddedSolanaWallet();
  return (
    <View
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderWidth: 1,
        borderColor: "black",
        padding: 10,
      }}
    >
      <Text>Wallets</Text>

      <View
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Button
          title="Create Ethereum Wallet"
          onPress={() => createEthereumWallet({ createAdditional: true })}
        />
        <Button
          title="Create Solana Wallet"
          onPress={() => createSolanaWallet?.({ createAdditional: true, recoveryMethod: "privy" })}
        />
      </View>
    </View>
  );
}
