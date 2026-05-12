import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useExportWallet as useSolanaExportWallet } from "@privy-io/react-auth/solana";

const query = new URLSearchParams(window.location.search);
const runtimeConfig =
  typeof window !== "undefined" && window.__CACHIN_EXPORT_CONFIG__
    ? window.__CACHIN_EXPORT_CONFIG__
    : {};
const appId = query.get("appId") || runtimeConfig.appId || "";
const clientId = query.get("clientId") || runtimeConfig.clientId || "";
const loginMethods = Array.isArray(runtimeConfig.loginMethods)
  ? runtimeConfig.loginMethods
  : ["passkey"];
const requestedAddress = (query.get("address") || "").trim();
const requestedChain = "solana";

function getErrorMessage(error) {
  if (!error) return "Unknown error.";
  if (typeof error === "string") return error;
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return "Export failed.";
}

function postResult(result) {
  const payload = JSON.stringify(result);

  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(payload);
  }
  if (window.webkit?.messageHandlers?.exportResult?.postMessage) {
    window.webkit.messageHandlers.exportResult.postMessage(payload);
  }
  if (window.AndroidBridge?.onExportResult) {
    window.AndroidBridge.onExportResult(payload);
  }
  if (window.exportResult?.postMessage) {
    window.exportResult.postMessage(payload);
  }
}

function accountChainType(account) {
  return account?.chainType || account?.chain_type || null;
}

function accountWalletClientType(account) {
  return (
    account?.walletClientType ||
    account?.wallet_client_type ||
    account?.wallet_client ||
    null
  );
}

function hasRequestedWallet(user) {
  const linkedAccounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : [];
  const normalizedRequestedAddress = requestedAddress.toLowerCase();

  return linkedAccounts.some((account) => {
    if (account?.type !== "wallet") return false;

    const chainType = accountChainType(account);
    if (chainType && chainType !== requestedChain) return false;

    const walletClientType = accountWalletClientType(account);
    if (walletClientType && walletClientType !== "privy") return false;

    if (normalizedRequestedAddress) {
      return (
        typeof account.address === "string" &&
        account.address.toLowerCase() === normalizedRequestedAddress
      );
    }

    return true;
  });
}

function ExportFlow() {
  const { ready, authenticated, user, login } = usePrivy();
  const { exportWallet: exportSolanaWallet } = useSolanaExportWallet();
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);

  const hasWallet = useMemo(() => hasRequestedWallet(user), [user]);
  const pushEvent = (label) => {
    const timestamp = new Date().toISOString();
    setEvents((prev) => [`${timestamp} ${label}`, ...prev].slice(0, 8));
  };

  async function handleLogin() {
    setError("");
    setStatus("");
    pushEvent("Login button tapped");
    try {
      setIsBusy(true);
      pushEvent(`Calling login with methods=${JSON.stringify(loginMethods)}`);
      await login({
        loginMethods,
      });
      pushEvent("login() resolved");
    } catch (err) {
      const message = getErrorMessage(err);
      pushEvent(`login() error: ${message}`);
      if (message.toLowerCase().includes("invalid nativeappid")) {
        setError(
          "Invalid nativeAppID. Use a Privy Web client ID for export.cachin.app and pass it as ?clientId=..."
        );
      } else {
        setError(message);
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleExport() {
    setError("");
    setStatus("");
    pushEvent("Export button tapped");
    try {
      setIsBusy(true);
      if (requestedAddress) {
        await exportSolanaWallet({ address: requestedAddress });
      } else {
        await exportSolanaWallet();
      }

      setStatus("Export completed. You can now close this screen.");
      pushEvent("exportWallet() resolved");
      postResult({
        status: "success",
        chain: requestedChain,
        address: requestedAddress || null,
      });
    } catch (err) {
      const message = getErrorMessage(err);
      pushEvent(`exportWallet() error: ${message}`);
      setError(message);
      postResult({
        status: "error",
        error: message,
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Export your wallet key</h1>
        <p className="subtitle">
          Sign in with Privy, then run exportWallet in this secure web context.
        </p>

        <div className="meta">
          <div>Chain: {requestedChain}</div>
          <div>Address: {requestedAddress || "default wallet (index 0)"}</div>
          <div>Ready: {ready ? "yes" : "no"}</div>
          <div>Authenticated: {authenticated ? "yes" : "no"}</div>
          <div>Wallet found: {hasWallet ? "yes" : "no"}</div>
          <div>Secure context: {window.isSecureContext ? "yes" : "no"}</div>
          <div>WebAuthn API: {"PublicKeyCredential" in window ? "yes" : "no"}</div>
        </div>

        <div className="actions">
          <button
            className="secondary"
            disabled={!ready || authenticated || isBusy}
            onClick={handleLogin}
          >
            {isBusy ? "Working..." : "Log in"}
          </button>
          <button
            className="primary"
            disabled={!ready || !authenticated || !hasWallet || isBusy}
            onClick={handleExport}
          >
            {isBusy ? "Exporting..." : "Export wallet"}
          </button>
        </div>

        {status ? <div className="status">{status}</div> : null}
        {error ? <div className="error">{error}</div> : null}
        {events.length ? (
          <div className="meta" style={{ marginTop: 12 }}>
            {events.map((event) => (
              <div key={event}>{event}</div>
            ))}
          </div>
        ) : null}

        <div className="note">
          Do not share your private key. Anyone with it can move your funds.
        </div>
      </div>
    </div>
  );
}

function MissingConfig() {
  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Missing Privy config</h1>
        <p className="subtitle">
          This page requires appId and clientId query params from the mobile app.
        </p>
        <div className="meta">
          <div>appId: {appId ? "present" : "missing"}</div>
          <div>clientId: {clientId ? "present" : "missing"}</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  if (!appId || !clientId) {
    return <MissingConfig />;
  }

  return (
    <PrivyProvider appId={appId} clientId={clientId}>
      <ExportFlow />
    </PrivyProvider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
