import React from "react";
import { Text, View, Button, ScrollView } from "react-native";

import {
  usePrivy,
} from "@privy-io/expo";
import { PrivyUser } from "@privy-io/public-api";
import Wallets from "./userManagement/Wallets";
import SolanaWalletActions from "./walletActions/SolanaWalletActions";

const toMainIdentifier = (x: PrivyUser["linked_accounts"][number]) => {
  if (x.type === "wallet") {
    return x.address;
  }
  return x.type;
};

export const UserScreen = () => {
  const { logout, user } = usePrivy();

  if (!user) {
    return null;
  }

  return (
    <ScrollView>
      <Wallets />
      <ScrollView style={{ borderColor: "rgba(0,0,0,0.1)", borderWidth: 1 }}>
        <View
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <View>
            <Text style={{ fontWeight: "bold" }}>User ID</Text>
            <Text>{user.id}</Text>
          </View>

          <View>
            <Text style={{ fontWeight: "bold" }}>Linked accounts</Text>
            {user?.linked_accounts.length ? (
              <View style={{ display: "flex", flexDirection: "column" }}>
                {user?.linked_accounts?.map((m, index) => (
                  <Text
                    key={`linked-account-${m.type}-${m.verified_at}-${index}`}
                    style={{
                      color: "rgba(0,0,0,0.5)",
                      fontSize: 12,
                      fontStyle: "italic",
                    }}
                  >
                    {m.type}: {toMainIdentifier(m)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          <SolanaWalletActions />
          <Button title="Logout" onPress={logout} />
        </View>
      </ScrollView>
    </ScrollView>
  );
};
