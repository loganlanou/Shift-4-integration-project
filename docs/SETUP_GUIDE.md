# Setup Guide

Complete step-by-step guide for setting up the Shift4 Payment Platform.

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- Shift4 test account
- Basic terminal/command line knowledge

## Part 1: Shift4 Account Setup

### 1.1 Create Shift4 Account

1. Visit https://shift4.com
2. Sign up for a test account
3. Verify your email address
4. Log in to the Shift4 Dashboard

### 1.2 Get API Keys

1. Navigate to **Settings → API Keys**
2. Copy your **Test Public Key** (starts with `pk_test_`)
3. Copy your **Test Secret Key** (starts with `sk_test_`)
4. Save these securely - you'll need them later

### 1.3 Configure Webhooks

1. Navigate to **Settings → Webhooks**
2. Click **Add Endpoint**
3. Enter URL: `https://your-domain.com/api/v1/webhooks/shift4`
   - For local development: Use ngrok or similar tunnel
   - Example: `https://abc123.ngrok.io/api/v1/webhooks/shift4`
4. Select events to listen for:
   - ✅ `charge.succeeded`
   - ✅ `charge.failed`
   - ✅ `charge.captured`
   - ✅ `charge.refunded`
   - ✅ `charge.dispute.created`
   - ✅ `charge.dispute.closed`
   - ✅ `refund.succeeded`
   - ✅ `refund.failed`
   - ✅ `payout.created`
   - ✅ `payout.paid`
5. Click **Save**
6. Copy the **Webhook Signing Secret** (if provided)

## Part 2: Application Setup

### 2.1 Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd Shift-4-integration-project

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

### 2.2 Environment Configuration

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` with your Shift4 credentials:

```env
# Database
DATABASE_URL="postgresql://shift4:shift4pass@localhost:5432/shift4_payments?schema=public"

# Application
NODE_ENV="development"
APP_URL="http://localhost:3000"

# Shift4 Configuration
SHIFT4_MODE="test"
SHIFT4_PUBLIC_KEY="pk_test_YOUR_KEY_HERE"
SHIFT4_SECRET_KEY="sk_test_YOUR_KEY_HERE"

# Shift4 Webhooks
SHIFT4_WEBHOOK_URL="https://your-ngrok-url.ngrok.io/api/v1/webhooks/shift4"
SHIFT4_WEBHOOK_SIGNING_SECRET=""  # If provided by Shift4

# UTG Configuration (skip if not using UTG)
UTG_ENABLED="false"

# SkyTab Configuration (skip if not using SkyTab)
SKYTAB_ENABLED="false"

# Security
JWT_SECRET="your-random-secret-key-generate-one"
ADMIN_PASSWORD="admin123"  # CHANGE THIS

# Logging
LOG_LEVEL="debug"
```

### 2.3 Start Database

**Option A: Using Docker (Recommended)**

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Wait for database to be ready
docker-compose logs -f postgres
# Look for "database system is ready to accept connections"
```

**Option B: Local PostgreSQL**

```bash
# Install PostgreSQL locally
# Create database
createdb shift4_payments

# Update DATABASE_URL in .env accordingly
```

### 2.4 Run Migrations

```bash
# Run database migrations
npx prisma migrate dev

# You should see:
# ✔ Generated Prisma Client
# ✔ Applied migrations
```

### 2.5 Seed Database

```bash
# Seed with test data
npx prisma db seed

# You should see:
# ✅ Created test user
# ✅ Created terminals
# ✅ Created sample orders
# etc.
```

### 2.6 Start Development Server

```bash
# Start Next.js development server
npm run dev

# Server should start on http://localhost:3000
```

### 2.7 Test the Installation

1. Open http://localhost:3000 in your browser
2. You should see the homepage with links to checkout and admin
3. Click "Try Online Checkout"
4. You should see the checkout page

## Part 3: Testing Online Payments

### 3.1 Test Checkout Flow

1. Navigate to http://localhost:3000/checkout
2. Click "Proceed to Payment"
3. Enter test card:
   - **Card Number**: 4242 4242 4242 4242
   - **Expiry**: Any future date (e.g., 12/25)
   - **CVC**: Any 3 digits (e.g., 123)
4. Click "Pay $50.00"
5. You should see "Payment Successful!"

### 3.2 Verify in Database

```bash
# Open Prisma Studio
npx prisma studio

# Navigate to "Payment" model
# You should see your test payment with status "CAPTURED"
```

### 3.3 Check Webhook Events

1. Navigate to http://localhost:3000/admin/webhooks
2. You should see webhook events from Shift4
3. Events should show `processed: true`

## Part 4: UTG Terminal Setup (Optional)

### 4.1 Install UTG Server

1. Contact Shift4 support for UTG software
2. Download and install on a machine on your local network
3. Note the machine's IP address (e.g., 192.168.1.100)

### 4.2 Configure UTG

1. Open UTG Admin Console
2. Create a new API Terminal
3. Configure settings:
   - EMV enabled
   - NFC enabled (if supported)
   - Note the **API Terminal ID**

### 4.3 Update Application Configuration

Edit `.env`:

```env
UTG_ENABLED="true"
UTG_HOST="192.168.1.100"  # Your UTG server IP
UTG_PORT="8333"  # Default UTG port
UTG_API_TERMINAL_ID="YOUR_API_TERMINAL_ID"
UTG_TIMEOUT_MS="60000"
UTG_RETRY_ATTEMPTS="2"
```

### 4.4 Register Terminal in Application

1. Navigate to http://localhost:3000/admin/terminals
2. Click "Add Terminal"
3. Fill in:
   - **Name**: Front Counter
   - **Type**: UTG
   - **API Terminal ID**: [from UTG]
   - **IP Address**: 192.168.1.100
   - **Port**: 8333
4. Click "Save"

### 4.5 Test Terminal Connection

1. On the terminal detail page, click "Ping Terminal"
2. You should see:
   - ✅ Online: true
   - Latency: ~XX ms

### 4.6 Test Terminal Payment

1. Navigate to terminal detail page
2. Click "Test Payment"
3. Enter amount: $0.01 (for testing)
4. UTG should prompt on the physical terminal
5. Follow terminal prompts to complete payment
6. Verify payment appears in admin panel

## Part 5: SkyTab Terminal Setup (Optional)

### 5.1 Get SkyTab API Credentials

1. Contact Shift4 for SkyTab API access
2. Request:
   - API URL
   - API Key
   - Merchant ID
3. Obtain device ID from your SkyTab device

### 5.2 Update Configuration

Edit `.env`:

```env
SKYTAB_ENABLED="true"
SKYTAB_API_URL="https://api.skytab.com"  # Or provided URL
SKYTAB_API_KEY="your_api_key"
SKYTAB_MERCHANT_ID="your_merchant_id"
```

### 5.3 Register Device

1. Navigate to http://localhost:3000/admin/terminals
2. Click "Add Terminal"
3. Fill in:
   - **Name**: Mobile Terminal
   - **Type**: SKYTAB
   - **API Terminal ID**: [Device ID from SkyTab]
4. Click "Save"

### 5.4 Test SkyTab

1. Click "Ping Terminal"
2. Verify device is online
3. Run test payment

## Part 6: Webhook Testing (Local Development)

For local development, Shift4 webhooks need a public URL.

### 6.1 Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com
```

### 6.2 Start ngrok Tunnel

```bash
# Start tunnel to port 3000
ngrok http 3000

# You'll see output like:
# Forwarding https://abc123.ngrok.io -> http://localhost:3000
```

### 6.3 Update Shift4 Webhook URL

1. Copy your ngrok URL (e.g., `https://abc123.ngrok.io`)
2. Go to Shift4 Dashboard → Webhooks
3. Edit your webhook endpoint
4. Update URL to: `https://abc123.ngrok.io/api/v1/webhooks/shift4`
5. Save

### 6.4 Update .env

```env
SHIFT4_WEBHOOK_URL="https://abc123.ngrok.io/api/v1/webhooks/shift4"
```

### 6.5 Test Webhooks

1. Make a test payment at http://localhost:3000/checkout
2. Check ngrok dashboard: http://127.0.0.1:4040
3. You should see POST requests to `/api/v1/webhooks/shift4`
4. Check application logs for webhook processing

## Part 7: Verification Checklist

Before moving to production, verify:

- [ ] Application starts without errors
- [ ] Database migrations applied successfully
- [ ] Online checkout works with test cards
- [ ] Payments appear in admin panel
- [ ] Webhooks are received and processed
- [ ] Terminal connectivity tested (if using terminals)
- [ ] Terminal payments work (if using terminals)
- [ ] Refunds can be created
- [ ] All environment variables set correctly
- [ ] Logs are working properly
- [ ] No errors in browser console
- [ ] No errors in server logs

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Prisma Migration Errors

```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset --force

# Re-run migrations
npx prisma migrate dev
```

### Shift4 Token Errors

- Verify `SHIFT4_PUBLIC_KEY` in .env
- Check browser console for errors
- Ensure Shift4 JS script loads correctly
- Verify test mode is enabled

### Terminal Connection Errors

- Verify IP address and port
- Check firewall rules allow traffic
- Ping UTG server from terminal
- Verify API Terminal ID is correct
- Check UTG server is running

### Webhook Not Received

- Verify ngrok is running
- Check ngrok dashboard for requests
- Verify webhook URL in Shift4 dashboard
- Check application logs for errors
- Verify endpoint is publicly accessible

## Next Steps

Once setup is complete:

1. Review [Architecture Documentation](ARCHITECTURE.md)
2. Explore the API via OpenAPI spec
3. Customize frontend components
4. Add business logic for your use case
5. Review [Cutover Plan](CUTOVER_PLAN.md) for production deployment
