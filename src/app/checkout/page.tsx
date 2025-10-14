'use client'

import { useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { ArrowLeft, Lock, CreditCard } from 'lucide-react'

/**
 * Online Checkout Page - Happy Trails Pizza Style
 * Demonstrates Shift4 JS Components integration
 */

export default function CheckoutPage() {
  const [amount] = useState(5000) // $50.00
  const [orderId, setOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Create checkout intent
  const createIntent = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/v1/checkout/online/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'usd',
          items: [
            {
              sku: 'DEMO-001',
              name: 'Demo Product',
              quantity: 1,
              price: amount,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout intent')
      }

      const data = await response.json()
      setOrderId(data.orderId)

      // Initialize Shift4 JS Components
      initializeShift4(data.publicKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Initialize Shift4 JS Components
  const initializeShift4 = (publicKey: string) => {
    // @ts-ignore - Shift4 global
    if (typeof Shift4 === 'undefined') {
      setError('Shift4 JS not loaded')
      return
    }

    // @ts-ignore
    const shift4 = Shift4(publicKey)

    // Create card element
    const cardElement = shift4.createCardElement()
    cardElement.mount('#card-element')

    // Handle form submission
    const form = document.getElementById('payment-form')
    form?.addEventListener('submit', async (e) => {
      e.preventDefault()
      setLoading(true)
      setError(null)

      try {
        // Create token
        const result = await shift4.createToken(cardElement)

        if (result.error) {
          setError(result.error.message)
          setLoading(false)
          return
        }

        // Confirm payment
        const response = await fetch('/api/v1/checkout/online/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            token: result.token.id,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error?.message || 'Payment failed')
        }

        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment failed')
      } finally {
        setLoading(false)
      }
    })
  }

  return (
    <div className="min-h-screen">
      <Script
        src="https://cdn.shift4.com/checkout/shift4-checkout.js"
        strategy="afterInteractive"
      />

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center text-charcoal hover:text-orange transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>
      </header>

      <div className="py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-charcoal mb-3">
              Secure Checkout
            </h1>
            <p className="text-lg text-charcoal-light">
              Complete your purchase with confidence
            </p>
          </div>

          <div className="card-warm">
            {!orderId && !success && (
              <div className="space-y-6">
                {/* Order Summary */}
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-2xl font-bold text-charcoal mb-4">Order Summary</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-charcoal-light">Demo Product</span>
                      <span className="font-medium text-charcoal">${(amount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-charcoal-light">Tax</span>
                      <span className="font-medium text-charcoal">$0.00</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                      <span className="text-xl font-bold text-charcoal">Total</span>
                      <span className="text-2xl font-bold text-orange">${(amount / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 text-sm text-charcoal-light bg-peach/50 p-3 rounded-lg">
                  <Lock className="w-4 h-4" />
                  <span>Secured by Shift4 - PCI DSS Level 1 Certified</span>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={createIntent}
                  disabled={loading}
                  className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Proceed to Payment'}
                </button>
              </div>
            )}

            {orderId && !success && (
              <form id="payment-form" className="space-y-6">
                {/* Payment Form Header */}
                <div className="text-center pb-4 border-b border-gray-200">
                  <div className="w-16 h-16 bg-orange/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="w-8 h-8 text-orange" />
                  </div>
                  <h2 className="text-2xl font-bold text-charcoal mb-2">Payment Details</h2>
                  <p className="text-charcoal-light">Enter your card information to complete the purchase</p>
                </div>

                {/* Card Element */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-3">
                    Card Information
                  </label>
                  <div
                    id="card-element"
                    className="border-2 border-gray-200 rounded-xl p-4 focus-within:border-orange transition-colors"
                  />
                  <p className="text-xs text-charcoal-light mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Your card details are encrypted and never stored
                  </p>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    <p className="font-medium">Payment Error</p>
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    `Pay $${(amount / 100).toFixed(2)}`
                  )}
                </button>

                {/* Payment Methods */}
                <div className="flex items-center justify-center gap-3 text-xs text-charcoal-light">
                  <span>We accept:</span>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 bg-white border border-gray-200 rounded">Visa</div>
                    <div className="px-2 py-1 bg-white border border-gray-200 rounded">Mastercard</div>
                    <div className="px-2 py-1 bg-white border border-gray-200 rounded">Amex</div>
                    <div className="px-2 py-1 bg-white border border-gray-200 rounded">Discover</div>
                  </div>
                </div>
              </form>
            )}

            {success && (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-charcoal mb-3">
                  Payment Successful!
                </h2>
                <p className="text-lg text-charcoal-light mb-8">
                  Thank you for your purchase. Your payment has been processed successfully.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-primary w-full"
                  >
                    Make Another Payment
                  </button>
                  <Link href="/" className="btn-secondary w-full block text-center">
                    Return to Home
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Test Cards Info */}
          {!success && (
            <div className="mt-8 bg-orange/10 border-2 border-orange/20 rounded-2xl p-6">
              <h3 className="font-bold text-charcoal mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange" />
                Test Cards
              </h3>
              <div className="space-y-2 text-sm text-charcoal-light">
                <p className="flex justify-between">
                  <span className="font-medium">Visa:</span>
                  <span className="font-mono">4242 4242 4242 4242</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium">Mastercard:</span>
                  <span className="font-mono">5555 5555 5555 4444</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium">Amex:</span>
                  <span className="font-mono">3782 822463 10005</span>
                </p>
                <p className="text-xs mt-3 text-center">
                  Use any future expiry date and any CVC
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
