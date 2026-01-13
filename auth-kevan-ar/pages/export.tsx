import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export default function ExportPage() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [addressParam, setAddressParam] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addr = params.get("address");
    setAddressParam(addr);
  }, []);

  const targetWallet = useMemo(() => {
    if (!addressParam || !wallets?.length) return null;
    return wallets.find((w) => w.address?.toLowerCase() === addressParam.toLowerCase()) || null;
  }, [addressParam, wallets]);

  const handleCopyAddress = async () => {
    if (!addressParam) return;
    try {
      await navigator.clipboard.writeText(addressParam);
      setCopied(true);
      setMessage("Address copied. Sign in to continue.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Unable to copy address. Copy it manually before proceeding.");
    }
  };

  const handleExport = async () => {
    setError(null);
    setMessage(null);

    if (!ready) {
      setError("Privy not ready yet. Please wait a moment.");
      return;
    }

    if (!authenticated) {
      await login();
      return;
    }

    if (!targetWallet) {
      setError("No matching wallet found for this address. Ensure you’re logged in with the right account.");
      return;
    }

    // Attempt to call a generic export method if present
    // Privy embedded wallets expose an export method in web contexts.
    try {
      setExporting(true);
      let exported: string | undefined;

      // @ts-expect-error - runtime availability check
      if (typeof targetWallet.export === "function") {
        // @ts-expect-error - runtime availability check
        exported = await targetWallet.export();
      }
      // @ts-expect-error - runtime availability check
      else if (typeof targetWallet.exportPrivateKey === "function") {
        // @ts-expect-error - runtime availability check
        exported = await targetWallet.exportPrivateKey();
      }

      if (!exported) {
        setError("Export method not available for this wallet.");
        return;
      }

      await navigator.clipboard.writeText(exported);
      setMessage("Private key exported to clipboard. Store it securely.");
    } catch (err: any) {
      console.error("Export error:", err);
      setError(err?.message || "Failed to export wallet. Ensure this wallet supports export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Export Wallet</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="page">
        <div className="card">
          <div className="badge">Secure export</div>
          <h1>Export Wallet</h1>
          <p>Authenticate with Privy on web, then export the private key locally in your browser.</p>

          {addressParam ? (
            <div className="section">
              <div className="label">Wallet address</div>
              <div className="address">{addressParam}</div>
              <button className="ghost" onClick={handleCopyAddress} disabled={copied}>
                {copied ? "Copied" : "Copy address"}
              </button>
            </div>
          ) : (
            <div className="error">No address provided. Open this page from the app.</div>
          )}

          <div className="section">
            <div className="label">Steps</div>
            <ol className="steps">
              <li>Sign in with the same account via Privy (web).</li>
              <li>Match the wallet shown above.</li>
              <li>Export locally; your key never leaves the browser.</li>
            </ol>
            <div className="warning">
              Never share your private key. Anyone with it controls your wallet.
            </div>
          </div>

          <button className="cta" onClick={handleExport} disabled={exporting || !addressParam}>
            {exporting ? "Exporting…" : authenticated ? "Export private key" : "Sign in & export"}
          </button>

          {message && <div className="info">{message}</div>}
          {error && <div className="error">{error}</div>}
        </div>
      </main>
    </>
  );
}
