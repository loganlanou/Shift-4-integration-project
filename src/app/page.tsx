import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Shift4 Payment Platform
          </h1>
          <p className="text-lg text-gray-600">
            Production-ready payment integration for online and in-person transactions
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              Online Checkout
            </h2>
            <p className="text-gray-600 mb-4">
              Accept card-not-present payments via Shift4 JS Components with tokenization
            </p>
            <Link
              href="/checkout"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Online Checkout
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              Terminal Payments
            </h2>
            <p className="text-gray-600 mb-4">
              Process card-present transactions via UTG or SkyTab devices
            </p>
            <Link
              href="/admin/terminals"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Manage Terminals
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/admin/orders"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Orders</h3>
            <p className="text-gray-600">View and manage all orders</p>
          </Link>

          <Link
            href="/admin/payouts"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Payouts</h3>
            <p className="text-gray-600">Track and reconcile payouts</p>
          </Link>

          <Link
            href="/admin/webhooks"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Webhooks</h3>
            <p className="text-gray-600">Monitor webhook events</p>
          </Link>
        </div>

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Features
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li>✅ Online payments with Shift4 JS Components</li>
            <li>✅ Terminal payments via UTG and SkyTab</li>
            <li>✅ Refunds and voids</li>
            <li>✅ Webhook processing</li>
            <li>✅ Payout reconciliation</li>
            <li>✅ Dispute management</li>
            <li>✅ Full audit trail</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
