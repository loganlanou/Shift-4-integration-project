'use client'

import { useState } from 'react'
import Script from 'next/script'

/**
 * Online Checkout Page
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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Script
        src="https://cdn.shift4.com/checkout/shift4-checkout.js"
        strategy="afterInteractive"
      />

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Online Checkout
          </h1>

          {!orderId && (
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h2 className="text-xl font-semibold mb-2">Order Summary</h2>
                <div className="flex justify-between text-lg">
                  <span>Demo Product</span>
                  <span>${(amount / 100).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={createIntent}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Proceed to Payment'}
              </button>
            </div>
          )}

          {orderId && !success && (
            <form id="payment-form" className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Details
                </label>
                <div
                  id="card-element"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Processing...' : `Pay $${(amount / 100).toFixed(2)}`}
              </button>
            </form>
          )}

          {success && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">
                Payment Successful!
              </h2>
              <p className="text-gray-600 mb-6">
                Your payment has been processed successfully.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Make Another Payment
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Test Cards</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>Visa: 4242 4242 4242 4242</li>
            <li>Mastercard: 5555 5555 5555 4444</li>
            <li>Any future expiry date and CVC</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
