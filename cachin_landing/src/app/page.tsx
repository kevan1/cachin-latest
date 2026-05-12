import Image from "next/image";

const betaHref =
  "mailto:hola@cachin.app?subject=Join%20the%20Cachin%20beta";

const navItems = [
  { label: "How it works", href: "#how" },
  { label: "Card", href: "#card" },
  { label: "Coverage", href: "#coverage" },
  { label: "FAQ", href: "#faq" },
];

const trustItems = [
  "Stablecoin funded",
  "Argentina MVP",
  "QR-native LATAM behavior",
  "Rate shown before pay",
  "Merchant upgrade layer",
];

const steps = [
  {
    number: "01",
    label: "Scan",
    title: "Open camera. Point at a supported local QR.",
    body: "Cachin fits the payment habit people already use across LATAM. You scan the QR, read the merchant, and review the total before anything moves.",
    visual: "scan",
  },
  {
    number: "02",
    label: "Confirm",
    title: "See the FX. Hold to pay.",
    body: "The local amount, stablecoin debit, rate, and fee are visible before confirm. The app is designed to make the number feel boringly clear.",
    visual: "tap",
  },
  {
    number: "03",
    label: "Done",
    title: "Paid receipt. You can go.",
    body: "After confirmation you get a two-currency receipt. Not a trading screen, not a wallet puzzle - just the proof that the payment landed.",
    visual: "done",
  },
];

const promiseItems = [
  {
    title: "Rate locked at confirm",
    body: "The rate you review is the rate used for the payment flow. No mystery statement markup later.",
  },
  {
    title: "Two-currency receipt",
    body: "Every payment keeps the local amount and stablecoin debit together so it is easy to audit.",
  },
  {
    title: "Low-jargon by design",
    body: "Cachin hides the chain mechanics behind a normal payment moment: fund, scan, confirm, pay.",
  },
];

const cardFeatures = [
  {
    label: "A",
    title: "Virtual first",
    body: "A card surface for trips, subscriptions, and backup checkout moments where QR is not the right path.",
  },
  {
    label: "B",
    title: "Funded from balance",
    body: "Authorizations are designed around the stablecoin balance users already keep in Cachin.",
  },
  {
    label: "C",
    title: "Plain controls",
    body: "Daily caps, travel mode, merchant categories, and country controls written in human language.",
  },
  {
    label: "D",
    title: "Fast recovery",
    body: "Freeze, replace, and keep the underlying balance separate from the card credential.",
  },
];

const countries = [
  {
    name: "Argentina",
    rail: "MODO-style / MP QR",
    badge: "MVP",
    tone: "live",
    flag: "ar",
  },
  {
    name: "Mexico",
    rail: "CoDi / OXXO path",
    badge: "Next",
    tone: "soon",
    flag: "mx",
  },
  {
    name: "Colombia",
    rail: "Bre-B / Nequi",
    badge: "Roadmap",
    tone: "soon",
    flag: "co",
  },
  {
    name: "Brazil",
    rail: "Pix / QR",
    badge: "Roadmap",
    tone: "soon",
    flag: "br",
  },
  {
    name: "Peru",
    rail: "Yape / Plin",
    badge: "Roadmap",
    tone: "soon",
    flag: "pe",
  },
  {
    name: "Uruguay",
    rail: "QR interop",
    badge: "Roadmap",
    tone: "soon",
    flag: "uy",
  },
  {
    name: "Costa Rica",
    rail: "SINPE Movil",
    badge: "Research",
    tone: "soon",
    flag: "cr",
  },
  {
    name: "More LATAM",
    rail: "Provider expansion",
    badge: "Later",
    tone: "soon",
    flag: "latam",
  },
];

const useCases = [
  {
    initials: "TR",
    title: "Travelers",
    body: "Arrive with money from outside the local system and still pay the QR on the counter like everyone else.",
  },
  {
    initials: "FW",
    title: "Freelancers",
    body: "Keep income in stablecoins, then spend through a payment flow that looks local at checkout.",
  },
  {
    initials: "MS",
    title: "Merchants",
    body: "Optional Cachin merchant flows can add faster confirmation, discounts, and lower-friction settlement.",
  },
];

const faqs = [
  {
    question: "Is Cachin a bank?",
    answer:
      "No. Cachin is a payments app. It is designed around stablecoin funding, supported local QR flows, clear confirmation, and receipts. It does not position itself as a deposit account or yield product.",
  },
  {
    question: "What stablecoins does it support?",
    answer:
      "The product direction starts with USDC and USDT, with Solana as the main low-cost rail. Other rails can be added when they improve coverage or reliability for supported countries.",
  },
  {
    question: "How does Cachin make money?",
    answer:
      "The intended model is a clear service fee shown before payment. The landing page avoids hidden FX promises: users should be able to see the rate, fee, local amount, and stablecoin debit before they confirm.",
  },
  {
    question: "Do I need a phone to pay?",
    answer:
      "QR payments need the app. Card or contactless flows can be a backup surface where the card program supports it. The landing page keeps the card positioned as a complementary line, not the core wedge.",
  },
  {
    question: "Where can I use it today?",
    answer:
      "The MVP focus is Argentina, with broader LATAM coverage handled as provider and partner rails are proven. Public claims should stay tied to verified proof in each country.",
  },
  {
    question: "What happens if something fails?",
    answer:
      "The product needs a clear receipt, visible payment state, and direct support path. If a payment cannot be completed, the user should know where it stopped and what to do next.",
  },
];

function Logo() {
  return (
    <span className="brand-lockup">
      <Image
        className="brand-star-image"
        src="/images/cachin-star-mark.png"
        alt=""
        width={44}
        height={44}
        priority
      />
      <Image
        className="brand-wordmark-image"
        src="/images/cachin-wordmark.png"
        alt=""
        width={360}
        height={140}
        priority
      />
    </span>
  );
}

function HeroScene() {
  return (
    <div className="hero-scene" aria-hidden="true">
      <Image
        className="hero-payment-image"
        src="/images/hero-device-cachin-square.png"
        alt=""
        width={900}
        height={900}
        priority
        sizes="(max-width: 900px) 420px, 560px"
      />
    </div>
  );
}

function StepVisual({ visual }: { visual: string }) {
  const src =
    visual === "scan"
      ? "/images/step-scan.png"
      : visual === "tap"
        ? "/images/step-tap.png"
        : "/images/step-paid.png";

  return (
    <div className="step-visual" aria-hidden="true">
      <Image
        className="step-visual-image"
        src={src}
        alt=""
        width={640}
        height={420}
        sizes="(max-width: 900px) 100vw, 33vw"
      />
    </div>
  );
}

function ContactlessCard() {
  return (
    <div className="tap-stage" aria-hidden="true">
      <Image
        className="contactless-card-image"
        src="/images/contactless-card.png"
        alt=""
        width={1120}
        height={840}
        sizes="(max-width: 900px) 100vw, 50vw"
      />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#top" className="brand-link" aria-label="Go to Cachin home">
            <Logo />
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <a className="button button-primary topbar-cta" href={betaHref}>
            Join beta <span aria-hidden="true">→</span>
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-pattern" aria-hidden="true" />
          <HeroScene />
          <div className="hero-content">
            <span className="status-pill">
              <span className="status-dot" />
              Private beta - Argentina MVP
            </span>
            <h1>
              Spend more effortlessly across <span>LATAM.</span>
            </h1>
            <p className="hero-copy">
              Fund Cachin with stablecoins, scan supported local QRs, confirm
              the FX before paying, and move through checkout like a local.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={betaHref}>
                Get the app <span aria-hidden="true">→</span>
              </a>
              <a className="button button-ghost" href="#how">
                How it works
              </a>
            </div>
            <div className="hero-mini" aria-label="Product promises">
              <span>Fund globally</span>
              <span>Pay locally</span>
              <span>No hidden FX</span>
            </div>
          </div>
        </section>

        <div className="page">
          <section className="trust-strip" aria-label="Cachin trust signals">
            {trustItems.map((item) => (
              <span key={item}>
                <span className="pip" aria-hidden="true" />
                {item}
              </span>
            ))}
          </section>

          <section id="how" className="content-section">
            <div className="eyebrow">
              <span>01</span>
              <p>How it works</p>
              <i aria-hidden="true" />
            </div>
            <div className="section-head">
              <h2>Scan, confirm, done. That is the product.</h2>
              <p>
                Cachin talks about the payment moment, not the infrastructure.
                The user should not need to understand wallets, gas, or rails
                to buy coffee, groceries, or a taxi ride.
              </p>
            </div>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step-card" key={step.number}>
                  <p className="step-label">
                    {step.number} - {step.label}
                  </p>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <StepVisual visual={step.visual} />
                </article>
              ))}
            </div>
          </section>

          <section className="content-section">
            <div className="eyebrow">
              <span>02</span>
              <p>The bridge</p>
              <i aria-hidden="true" />
            </div>
            <div className="bridge-panel">
              <div className="bridge-copy">
                <h2>Fund globally. Pay locally.</h2>
                <p>
                  One funded balance, normal local checkout. Cachin handles the
                  conversion at the payment moment and shows the rate before
                  confirm.
                </p>
              </div>
              <div className="bridge-flow" aria-label="Funding to payment flow">
                <article className="bridge-node">
                  <span className="node-label">Step A - Fund</span>
                  <div className="node-row">
                    <span className="node-icon">$</span>
                    <div>
                      <h3>USDC / USDT</h3>
                      <p>Solana-first stablecoin funding</p>
                    </div>
                  </div>
                  <ul>
                    <li>From an exchange or wallet</li>
                    <li>Built for travelers and freelancers</li>
                    <li>Crypto mechanics stay behind the scenes</li>
                  </ul>
                </article>

                <div className="flow-arrow" aria-hidden="true">
                  <span>Rate preview</span>
                  <i />
                  <span>No hidden margin</span>
                </div>

                <article className="bridge-node">
                  <span className="node-label">Step B - Pay</span>
                  <div className="node-row">
                    <span className="node-icon node-icon-blue">QR</span>
                    <div>
                      <h3>ARS / MXN / COP / BRL</h3>
                      <p>Local QR and card surfaces</p>
                    </div>
                  </div>
                  <ul>
                    <li>Supported local QR flows</li>
                    <li>Optional merchant upgrade rails</li>
                    <li>Receipt in two currencies</li>
                  </ul>
                </article>
              </div>
            </div>
          </section>

          <section className="content-section split-section">
            <div className="receipt" aria-label="Example Cachin receipt">
              <div className="receipt-head">
                <span>çachin receipt</span>
                <small>14:09 GMT-3</small>
              </div>
              <dl>
                <div>
                  <dt>Merchant</dt>
                  <dd>Cafe Tortoni</dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>Buenos Aires - AR</dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <dd>1 USDC = 1,754.16 ARS</dd>
                </div>
                <div>
                  <dt>Local amount</dt>
                  <dd>ARS 8,420</dd>
                </div>
                <div>
                  <dt>Fee</dt>
                  <dd>USDC 0.024</dd>
                </div>
                <div className="receipt-total">
                  <dt>Total</dt>
                  <dd>4.80 USDC</dd>
                </div>
              </dl>
              <strong className="receipt-stamp">Paid</strong>
              <p>No markup surprise - no checkout drama</p>
            </div>

            <div className="promise-copy">
              <div className="eyebrow compact">
                <span>03</span>
                <p>The promise</p>
                <i aria-hidden="true" />
              </div>
              <h2>More control than a foreign card.</h2>
              <p>
                The landing page centers the strongest user promise: before you
                pay, you know the FX, fee, local total, and stablecoin debit.
              </p>
              <div className="promise-list">
                {promiseItems.map((item) => (
                  <article key={item.title} className="promise-item">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <a className="button button-primary" href={betaHref}>
                Try it in beta <span aria-hidden="true">→</span>
              </a>
            </div>
          </section>

          <section id="card" className="content-section card-section">
            <div className="eyebrow">
              <span>04</span>
              <p>The card</p>
              <i aria-hidden="true" />
            </div>
            <div className="card-layout">
              <ContactlessCard />
              <div>
                <h2>Phone optional when the program supports it.</h2>
                <p className="section-copy">
                  QR is the wedge. Card and contactless surfaces are the backup
                  for older users, dead batteries, subscriptions, and checkout
                  moments where tapping is simply faster.
                </p>
                <div className="feature-grid">
                  {cardFeatures.map((feature) => (
                    <article className="feature-card" key={feature.title}>
                      <span>{feature.label}</span>
                      <h3>{feature.title}</h3>
                      <p>{feature.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="stripe-section" aria-hidden="true">
          <div className="stripe-bar">
            <div className="stripe-track">
              <span>scan.</span>
              <span>confirm.</span>
              <span>paid.</span>
              <span>fund globally.</span>
              <span>pay locally.</span>
              <span>scan.</span>
              <span>confirm.</span>
              <span>paid.</span>
              <span>fund globally.</span>
              <span>pay locally.</span>
            </div>
          </div>
        </section>

        <div className="page">
          <section id="coverage" className="content-section">
            <div className="eyebrow">
              <span>05</span>
              <p>Coverage</p>
              <i aria-hidden="true" />
            </div>
            <div className="section-head">
              <h2>Built from LATAM for the world.</h2>
              <p>
                The product starts with an Argentina MVP and expands only where
                rails, providers, and compliance are proven. Coverage copy stays
                precise instead of pretending every country is already live.
              </p>
            </div>
            <div className="coverage-grid">
              {countries.map((country) => (
                <article className="country-card" key={country.name}>
                  <span className={`flag flag-${country.flag}`} aria-hidden="true" />
                  <h3>{country.name}</h3>
                  <div>
                    <span>{country.rail}</span>
                    <strong className={`badge badge-${country.tone}`}>
                      {country.badge}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="manifesto" className="content-section manifesto-section">
            <div className="eyebrow">
              <span>06</span>
              <p>Manifesto</p>
              <i aria-hidden="true" />
            </div>
            <div className="section-head">
              <h2>Normal payments beat crypto explanations.</h2>
              <p>
                Cachin wins when a visitor, freelancer, or local merchant can
                use it without becoming an infrastructure expert.
              </p>
            </div>
            <div className="use-case-grid">
              {useCases.map((item) => (
                <article className="use-case" key={item.title}>
                  <span>{item.initials}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="faq" className="content-section">
            <div className="eyebrow">
              <span>07</span>
              <p>FAQ</p>
              <i aria-hidden="true" />
            </div>
            <div className="section-head">
              <h2>Direct answers. No fine-print theater.</h2>
              <p>
                If a claim depends on a country, provider, card program, or
                compliance flow, the answer says so.
              </p>
            </div>
            <div className="faq-list">
              {faqs.map((faq, index) => (
                <details className="faq-item" key={faq.question} open={index === 0}>
                  <summary>
                    {faq.question}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <section className="final-cta">
          <div className="final-cta-inner">
            <h2>
              Scan, confirm, <span>paid.</span>
            </h2>
            <p>
              Join the beta for the Argentina MVP and help turn global funding
              into local payment ability across LATAM.
            </p>
            <div className="final-actions">
              <a className="button button-primary" href={betaHref}>
                Join beta <span aria-hidden="true">→</span>
              </a>
              <a className="button button-light" href="#manifesto">
                Read the manifesto
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>
              Frictionless payments for people earning globally and spending
              locally across LATAM.
            </p>
          </div>
          <nav aria-label="Footer product links">
            <strong>Product</strong>
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <nav aria-label="Footer contact links">
            <strong>Contact</strong>
            <a href="mailto:hola@cachin.app">hola@cachin.app</a>
            <a href={betaHref}>Beta access</a>
            <a href="#manifesto">Manifesto</a>
          </nav>
        </div>
        <div className="page footer-bottom">
          <span>çachin - 2026</span>
          <span>Built from LATAM for the world</span>
        </div>
      </footer>
    </>
  );
}
