import Head from "next/head";

const LAST_UPDATED = "January 5, 2026";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy | Cachin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="page">
        <article className="card policy">
          <div className="badge">Privacy Policy</div>
          <h1>Privacy Policy</h1>
          <p className="policy-updated">Last updated: {LAST_UPDATED}</p>
          <p>
            This Privacy Policy explains how Cachin (the "App", "we", "our", or "us") collects,
            uses, and shares information when you use the Cachin mobile app and related services.
          </p>

          <section className="policy-section">
            <h2>Information we collect</h2>
            <ul className="policy-list">
              <li>Account information you provide, such as email and chosen username.</li>
              <li>Wallet addresses associated with your account and public blockchain data tied to those addresses.</li>
              <li>Transaction history stored locally on your device to show recent activity.</li>
              <li>Authentication data needed to enable passkey login and secure access.</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>How we use information</h2>
            <ul className="policy-list">
              <li>Authenticate you and manage your wallet access.</li>
              <li>Display balances, transaction history, and transfers.</li>
              <li>Enable QR code scanning and sharing of your payment link.</li>
              <li>Provide account features like username lookup and wallet export on web.</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>Information we share</h2>
            <ul className="policy-list">
              <li>Privy for authentication and wallet services.</li>
              <li>Firebase (Firestore) to store usernames linked to wallet addresses.</li>
              <li>Blockchain RPC providers to read balances and transaction data.</li>
            </ul>
            <p className="policy-note">
              We do not sell your personal information and do not use data for cross-app tracking or advertising.
            </p>
          </section>

          <section className="policy-section">
            <h2>Permissions and device data</h2>
            <ul className="policy-list">
              <li>Camera access is used to scan QR codes for payments.</li>
              <li>Biometric authentication (Face ID/Touch ID) may be used for passkey sign-in.</li>
              <li>We do not request access to your microphone, contacts, or precise location.</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>Data retention</h2>
            <p>
              We keep username and wallet mapping data for as long as your account is active. Local
              app data remains on your device until you clear it, sign out, or uninstall the app.
            </p>
          </section>

          <section className="policy-section">
            <h2>Your choices</h2>
            <ul className="policy-list">
              <li>Update your username in the app at any time.</li>
              <li>Manage passkeys and biometrics in your device settings.</li>
              <li>Request deletion of your account data by contacting us.</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>Security</h2>
            <p>
              We use secure storage and encrypted connections where appropriate. No method of
              transmission or storage is 100% secure, but we work to protect your information.
            </p>
          </section>

          <section className="policy-section">
            <h2>Children</h2>
            <p>The App is not intended for children under 13, and we do not knowingly collect data from them.</p>
          </section>

          <section className="policy-section">
            <h2>Contact us</h2>
            <p>
              Questions or requests? Email us at <span className="policy-contact">support@cachin.app</span>.
            </p>
          </section>

          <section className="policy-section">
            <h2>Changes to this policy</h2>
            <p>
              We may update this policy from time to time. If we make material changes, we will
              update the date at the top of this page.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
