# Shift4 Payment Platform

Production-ready web application for processing online (card-not-present) and in-person (card-present) payments via Shift4, with support for UTG and SkyTab terminal hardware.

## Features

- ✅ **Online Payments**: Card-not-present via Shift4 JS Components with tokenization
- ✅ **Terminal Payments**: Card-present via UTG and SkyTab hardware
- ✅ **Refunds & Voids**: Full and partial refund support
- ✅ **Webhook Processing**: Automatic event handling from Shift4
- ✅ **Payout Reconciliation**: Track and reconcile payouts with orders
- ✅ **Dispute Management**: Handle chargebacks and disputes
- ✅ **PCI Compliance**: No PAN storage, token-based architecture
- ✅ **Audit Trail**: Complete logging of all payment operations
- ✅ **Test Mode**: Separate test/live configurations

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Shift4 JS Components

### Backend
- Next.js API Routes
- PostgreSQL
- Prisma ORM
- Zod validation

### Infrastructure
- Docker & Docker Compose
- Nginx reverse proxy
- Makefile automation

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Shift4 account with test API keys

### Installation

1. **Clone and install dependencies**

```bash
git clone <repository-url>
cd Shift-4-integration-project
make install
```

2. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` and add your Shift4 credentials:

```env
# Shift4 Configuration
SHIFT4_MODE="test"
SHIFT4_PUBLIC_KEY="pk_test_YOUR_KEY"
SHIFT4_SECRET_KEY="sk_test_YOUR_KEY"
```

3. **Start services with Docker**

```bash
make docker-up
```

4. **Run database migrations**

```bash
make migrate
make seed
```

5. **Start development server**

```bash
make dev
```

Visit http://localhost:3000

### Alternative: Development without Docker

```bash
# Start PostgreSQL separately
# Update DATABASE_URL in .env

make setup    # Install + migrate + seed
make dev      # Start Next.js dev server
```

## Project Structure

```
.
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/v1/            # API endpoints
│   │   ├── checkout/          # Checkout pages
│   │   └── admin/             # Admin dashboard
│   ├── payments/              # Payment module
│   │   ├── adapters/          # Shift4, UTG, SkyTab adapters
│   │   ├── types.ts           # Type definitions
│   │   └── errors.ts          # Custom errors
│   ├── lib/                   # Utilities
│   └── components/            # React components
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── openapi/
│   └── spec.yaml              # API specification
├── docs/                      # Documentation
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── README.md
```

## Configuration

### Shift4 Setup

1. **Get API Keys**
   - Sign up at https://shift4.com
   - Navigate to Dashboard → Settings → API Keys
   - Copy your test public and secret keys

2. **Configure Webhooks**
   - In Shift4 Dashboard → Webhooks
   - Add endpoint: `https://yourdomain.com/api/v1/webhooks/shift4`
   - Select events:
     - `charge.succeeded`
     - `charge.failed`
     - `charge.refunded`
     - `charge.dispute.created`
     - `refund.succeeded`
     - `payout.paid`

3. **Update `.env`**

```env
SHIFT4_WEBHOOK_URL="https://yourdomain.com/api/v1/webhooks/shift4"
```

### UTG Terminal Setup

1. **Install UTG Server**
   - Download from Shift4 support portal
   - Install on local network
   - Note IP address and port (default 8333)

2. **Configure API Terminal ID**
   - In UTG admin, create API terminal
   - Note the API Terminal ID

3. **Update `.env`**

```env
UTG_ENABLED="true"
UTG_HOST="192.168.1.100"
UTG_PORT="8333"
UTG_API_TERMINAL_ID="YOUR_TERMINAL_ID"
```

4. **Register Terminal in App**
   - Navigate to `/admin/terminals`
   - Click "Add Terminal"
   - Select UTG type
   - Enter configuration

### SkyTab Terminal Setup

1. **Get API Credentials**
   - Contact Shift4 for SkyTab API access
   - Obtain API key and merchant ID

2. **Update `.env`**

```env
SKYTAB_ENABLED="true"
SKYTAB_API_KEY="your_api_key"
SKYTAB_MERCHANT_ID="your_merchant_id"
```

3. **Register Device**
   - Get device ID from SkyTab device settings
   - Register in app via `/admin/terminals`

## Usage

### Online Checkout

```typescript
// 1. Create checkout intent
const intent = await fetch('/api/v1/checkout/online/intent', {
  method: 'POST',
  body: JSON.stringify({
    amount: 5000, // $50.00 in cents
    currency: 'usd'
  })
})

// 2. Initialize Shift4 JS Components
const shift4 = Shift4(publicKey)
const cardElement = shift4.createCardElement()
cardElement.mount('#card-element')

// 3. Create token
const { token } = await shift4.createToken(cardElement)

// 4. Confirm payment
const payment = await fetch('/api/v1/checkout/online/confirm', {
  method: 'POST',
  body: JSON.stringify({
    orderId: intent.orderId,
    token: token.id
  })
})
```

### Terminal Payment

```typescript
// 1. Start payment on terminal
const tx = await fetch('/api/v1/checkout/terminal/pay', {
  method: 'POST',
  body: JSON.stringify({
    terminalId: 'term_123',
    orderId: 'order_456',
    amount: 5000,
    tipMode: 'prompt'
  })
})

// 2. Poll for status
const checkStatus = async (txId: string) => {
  const status = await fetch(`/api/v1/checkout/terminal/status/${txId}`)
  return status.json()
}

// Poll every 2 seconds
const interval = setInterval(async () => {
  const status = await checkStatus(tx.transactionId)
  if (status.status !== 'pending') {
    clearInterval(interval)
    // Handle completion
  }
}, 2000)
```

### Create Refund

```typescript
const refund = await fetch('/api/v1/refunds', {
  method: 'POST',
  body: JSON.stringify({
    paymentId: 'pay_123',
    amount: 2500, // Partial refund: $25.00
    reason: 'Customer request'
  })
})
```

## API Documentation

Full OpenAPI 3.1 specification available at `openapi/spec.yaml`

### Key Endpoints

#### Checkout
- `POST /api/v1/checkout/online/intent` - Create online checkout
- `POST /api/v1/checkout/online/confirm` - Confirm payment with token
- `POST /api/v1/checkout/terminal/pay` - Start terminal payment
- `GET /api/v1/checkout/terminal/status/:id` - Poll terminal status

#### Terminals
- `GET /api/v1/terminals` - List terminals
- `POST /api/v1/terminals` - Register terminal
- `PUT /api/v1/terminals/:id` - Update terminal
- `POST /api/v1/terminals/:id/ping` - Test connectivity

#### Refunds
- `POST /api/v1/refunds` - Create refund
- `GET /api/v1/refunds` - List refunds

#### Webhooks
- `POST /api/v1/webhooks/shift4` - Receive Shift4 events

## Testing

### Test Cards

For online payments in test mode:

- **Visa**: 4242 4242 4242 4242
- **Mastercard**: 5555 5555 5555 4444
- **Amex**: 3782 822463 10005
- **Discover**: 6011 1111 1111 1117

Use any future expiry date and any 3-4 digit CVC.

### Terminal Testing

1. **Test UTG Connection**

```bash
curl -X POST http://localhost:3000/api/v1/terminals/{terminalId}/ping
```

2. **Test Payment**

Navigate to `/admin/terminals` and use "Test Payment" button.

### Unit Tests

```bash
make test
```

### Integration Tests

```bash
make test-integration
```

## Deployment

### Docker Production Build

```bash
# Build image
docker build -t shift4-platform .

# Run container
docker run -p 3000:3000 --env-file .env shift4-platform
```

### Environment Variables

See `.env.example` for complete list. Critical variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Shift4
SHIFT4_MODE="live"  # Change to "live" for production
SHIFT4_PUBLIC_KEY="pk_live_..."
SHIFT4_SECRET_KEY="sk_live_..."
SHIFT4_WEBHOOK_URL="https://yourdomain.com/api/v1/webhooks/shift4"

# Security
JWT_SECRET="generate-a-strong-secret"
ADMIN_PASSWORD="change-this-immediately"
```

### Network Requirements

**Outbound (from your server)**:
- Shift4 API: `api.shift4.com` (port 443)
- UTG Server: Your UTG IP and port (typically 8333)

**Inbound (to your server)**:
- Webhooks from Shift4 IP ranges (see Shift4 docs)
- Configure firewall to allow webhook IPs

## Makefile Commands

```bash
make help              # Show all commands
make install           # Install dependencies
make dev              # Start development server
make build            # Build for production
make migrate          # Run database migrations
make seed             # Seed database
make test             # Run tests
make docker-up        # Start Docker containers
make docker-down      # Stop Docker containers
make setup            # Full setup (install + migrate + seed)
```

## Security

### PCI Compliance

- **Tokenization**: Card numbers never reach your server
- **Shift4 JS Components**: Client-side encryption
- **No PAN Storage**: Only tokens stored in database
- **P2PE Terminals**: UTG/SkyTab handle encryption

### Best Practices

1. **Secrets Management**: Use environment variables, never commit secrets
2. **HTTPS Only**: Always use HTTPS in production
3. **Webhook Verification**: Verify webhook signatures (if provided by Shift4)
4. **Network Security**: Whitelist Shift4 webhook IPs
5. **Audit Logging**: All payment operations logged
6. **Rate Limiting**: Implement rate limiting on API endpoints

## Troubleshooting

### Common Issues

**Database connection fails**

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection
docker-compose exec postgres psql -U shift4 -d shift4_payments
```

**UTG terminal offline**

```bash
# Test connectivity
curl -X POST http://localhost:3000/api/v1/terminals/{id}/ping

# Check UTG server is running
# Check IP address and port in .env
# Verify firewall allows traffic
```

**Webhooks not received**

- Check webhook URL is publicly accessible
- Verify webhook endpoint in Shift4 dashboard
- Check firewall allows Shift4 IP ranges
- Review webhook logs: `/admin/webhooks`

**Token creation fails**

- Verify `SHIFT4_PUBLIC_KEY` is correct
- Check Shift4 JS Components script loads
- Open browser console for errors

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System architecture and diagrams
- [API Setup Guide](docs/SETUP_GUIDE.md) - Detailed setup instructions
- [Cutover Plan](docs/CUTOVER_PLAN.md) - Test to live migration
- [OpenAPI Spec](openapi/spec.yaml) - Complete API documentation

## Support

For issues with:

- **This application**: Create an issue in this repository
- **Shift4 API**: Contact Shift4 support
- **UTG**: Shift4 UTG support portal
- **SkyTab**: Shift4 SkyTab support

## License

MIT License - See LICENSE file

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Prisma](https://www.prisma.io/)
- [Shift4](https://shift4.com/)
- [Tailwind CSS](https://tailwindcss.com/)
