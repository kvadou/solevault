import Link from "next/link";
import { Vault, Shield, Zap, TrendingUp, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-600 mb-6">
              <Vault className="h-3.5 w-3.5" />
              Now in Beta
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1]">
              Your sneakers.
              <br />
              <span className="text-[var(--accent)]">Vaulted. Tradeable.</span>
              <br />
              Instantly.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[var(--muted-foreground)] max-w-xl leading-relaxed">
              The first sneaker vault marketplace. Authenticate, vault, and trade sneakers
              instantly — no shipping between trades. Ever.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-6 py-3 text-base font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                Browse Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/vault/submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-6 py-3 text-base font-semibold hover:bg-[var(--muted)] transition-colors"
              >
                Vault Your Sneakers
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t border-[var(--border)] bg-[var(--muted)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--accent)]/10">
                <Shield className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold">Authenticated & Insured</h3>
              <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                Every pair is professionally authenticated before entering our climate-controlled vault.
                Fully insured at market value.
              </p>
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--accent)]/10">
                <Zap className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold">Instant Trades</h3>
              <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                Buy and sell in seconds. Ownership transfers instantly in the vault — no shipping, no waiting,
                no middleman delays.
              </p>
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--accent)]/10">
                <TrendingUp className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold">5% Total Fees</h3>
              <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                Just 2.5% buyer + 2.5% seller. Compare that to StockX (up to 12.5%) or GOAT (up to 25%).
                Keep more of what&apos;s yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Send Your Kicks", desc: "Ship your sneakers to our vault. We provide prepaid labels." },
              { step: "02", title: "We Authenticate", desc: "Expert authentication. If it's fake, we send it back. No charge." },
              { step: "03", title: "Vaulted & Insured", desc: "Your pair goes into climate-controlled storage. Fully insured." },
              { step: "04", title: "Trade Instantly", desc: "List and sell on our marketplace. Buyer gets vault ownership in seconds." },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-3">
                <div className="text-4xl font-bold text-[var(--accent)]">{item.step}</div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)] bg-[var(--primary)] text-[var(--primary-foreground)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Stop sitting on dead capital.</h2>
          <p className="text-lg opacity-80 mb-8 max-w-md mx-auto">
            Your collection is worth money. Vault it. Trade it. Cash out whenever you want.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
