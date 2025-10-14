import Link from 'next/link'
import { CreditCard, Smartphone, ShieldCheck, Clock, Zap, Users } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-orange rounded-full flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-charcoal">Payment Platform</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-charcoal hover:text-orange transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-charcoal hover:text-orange transition-colors">
              How It Works
            </Link>
            <Link href="/admin/terminals" className="text-charcoal hover:text-orange transition-colors">
              Admin
            </Link>
            <Link href="/checkout" className="btn-primary">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange/10 to-peach"></div>
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-charcoal mb-6 leading-tight">
              Accept Payments
              <span className="block text-orange">Anywhere, Anytime</span>
            </h1>
            <p className="text-xl md:text-2xl text-charcoal-light mb-8 leading-relaxed">
              Complete payment solution for online checkout and in-person transactions.
              Powered by Shift4, trusted by businesses everywhere.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/checkout" className="btn-primary text-lg px-8 py-4">
                Try Online Checkout
              </Link>
              <Link href="/admin/terminals" className="btn-secondary text-lg px-8 py-4">
                Manage Terminals
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="section-heading">Everything You Need</h2>
            <p className="text-lg text-charcoal-light max-w-2xl mx-auto">
              A complete payment platform designed for modern businesses
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            <div className="card-warm">
              <div className="w-12 h-12 bg-orange/10 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6 text-orange" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Online Payments</h3>
              <p className="text-charcoal-light">
                Secure card-not-present transactions with Shift4 JS Components. No PAN data ever touches your servers.
              </p>
            </div>

            <div className="card-warm">
              <div className="w-12 h-12 bg-orange/10 rounded-full flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-orange" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Terminal Payments</h3>
              <p className="text-charcoal-light">
                Card-present transactions via UTG and SkyTab hardware. Support for EMV, NFC, and tipping.
              </p>
            </div>

            <div className="card-warm">
              <div className="w-12 h-12 bg-orange/10 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-orange" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">PCI Compliant</h3>
              <p className="text-charcoal-light">
                Built with security first. Tokenization, encryption, and no sensitive data storage.
              </p>
            </div>

            <div className="card-warm">
              <div className="w-12 h-12 bg-orange/10 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-orange" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Real-Time Updates</h3>
              <p className="text-charcoal-light">
                Webhook processing for instant payment updates, refunds, disputes, and payouts.
              </p>
            </div>

            <div className="card-warm">
              <div className="w-12 h-12 bg-orange/10 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-orange" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Fast & Reliable</h3>
              <p className="text-charcoal-light">
                Lightning-fast checkout experience with automatic retries and offline support.
              </p>
            </div>

            <div className="card-warm">
              <div className="w-12 h-12 bg-orange/10 rounded-full flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-orange" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Customer Management</h3>
              <p className="text-charcoal-light">
                Save payment methods, manage subscriptions, and provide one-click checkout.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="section-heading">How It Works</h2>
            <p className="text-lg text-charcoal-light max-w-2xl mx-auto">
              Get started in minutes with our simple integration
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-orange text-white rounded-full flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold text-charcoal mb-2">Create Checkout</h3>
                  <p className="text-charcoal-light">
                    Initialize a checkout session with your order details and get a secure token.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-orange text-white rounded-full flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-bold text-charcoal mb-2">Collect Payment</h3>
                  <p className="text-charcoal-light">
                    Use Shift4 Components for online or connect to your terminal for in-person payments.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-orange text-white rounded-full flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-bold text-charcoal mb-2">Process & Confirm</h3>
                  <p className="text-charcoal-light">
                    Payment is securely processed and you receive instant confirmation via webhooks.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className="bg-gradient-to-br from-orange/20 to-peach p-8 rounded-2xl">
                <div className="bg-white rounded-xl p-6 mb-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="bg-white rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-6 bg-orange/20 rounded w-1/3"></div>
                    <div className="h-6 bg-green-100 rounded-full px-3 py-1 text-xs">✓ Secure</div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-10 bg-gray-100 rounded"></div>
                    <div className="h-10 bg-gray-100 rounded"></div>
                    <div className="h-12 bg-orange rounded-lg flex items-center justify-center text-white font-bold">
                      Complete Payment
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange to-orange-dark text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Start accepting payments today with our production-ready platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/checkout"
              className="bg-white text-orange px-8 py-4 rounded-full font-bold text-lg hover:bg-peach transition-all hover:shadow-xl"
            >
              Try Demo Checkout
            </Link>
            <Link
              href="/admin/terminals"
              className="bg-charcoal text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-charcoal-light transition-all hover:shadow-xl"
            >
              View Admin Panel
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-charcoal text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Payment Platform</h3>
              <p className="text-gray-400 text-sm">
                Production-ready Shift4 integration for online and in-person payments.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/checkout" className="hover:text-orange transition-colors">Online Checkout</Link></li>
                <li><Link href="/admin/terminals" className="hover:text-orange transition-colors">Terminal Management</Link></li>
                <li><Link href="/admin/orders" className="hover:text-orange transition-colors">Orders</Link></li>
                <li><Link href="/admin/payouts" className="hover:text-orange transition-colors">Payouts</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/docs/ARCHITECTURE.md" className="hover:text-orange transition-colors">Documentation</a></li>
                <li><a href="/openapi/spec.yaml" className="hover:text-orange transition-colors">API Reference</a></li>
                <li><a href="https://dev.shift4.com" className="hover:text-orange transition-colors">Shift4 Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Built with Shift4</li>
                <li>PCI DSS Compliant</li>
                <li>SOC 2 Type II</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2024 Payment Platform. Powered by Shift4.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
