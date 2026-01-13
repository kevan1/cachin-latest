import type { AppProps } from "next/app";
import { PrivyProvider } from "@privy-io/react-auth";
import "../styles/globals.css";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: { accentColor: "#111827", theme: "light" },
      }}
    >
      <Component {...pageProps} />
    </PrivyProvider>
  );
}
