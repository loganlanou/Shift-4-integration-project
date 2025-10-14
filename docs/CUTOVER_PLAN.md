# Cutover Plan: Test to Live

Complete guide for migrating from Shift4 test mode to production live mode.

## Pre-Cutover Checklist

### Business Requirements
- [ ] Shift4 merchant account approved and active
- [ ] Live API keys obtained from Shift4
- [ ] Payment processing agreement signed
- [ ] Bank account connected for payouts
- [ ] Merchant descriptor configured
- [ ] Processing fees understood and accepted

### Technical Requirements
- [ ] All test scenarios passed successfully
- [ ] Webhook endpoints tested and verified
- [ ] SSL certificate installed and valid
- [ ] Domain configured with DNS
- [ ] Firewall rules configured
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] PCI compliance verified

### Testing Validation
- [ ] Online payments tested with all major card brands
- [ ] Terminal payments tested (if applicable)
- [ ] Refunds tested (full and partial)
- [ ] Webhooks processing correctly
- [ ] Error handling verified
- [ ] Edge cases tested
- [ ] Performance benchmarks met

## Phase 1: Pre-Production Setup

### 1.1 Obtain Live Credentials

1. **Get Live API Keys**
   - Log in to Shift4 Dashboard
   - Navigate to Settings → API Keys
   - Switch to "Live" mode
   - Copy Live Public Key (`pk_live_...`)
   - Copy Live Secret Key (`sk_live_...`)
   - **IMPORTANT**: Store securely, never commit to git

2. **Configure Live Webhooks**
   - Navigate to Settings → Webhooks (Live Mode)
   - Add production endpoint: `https://yourdomain.com/api/v1/webhooks/shift4`
   - Select all necessary events (same as test)
   - Copy webhook signing secret
   - Test webhook delivery

### 1.2 Production Environment Setup

1. **Update Environment Variables**

Create production `.env.production`:

```env
# Database
DATABASE_URL="postgresql://prod_user:secure_password@prod-db:5432/shift4_payments?schema=public"

# Application
NODE_ENV="production"
APP_URL="https://yourdomain.com"

# Shift4 Configuration - LIVE MODE
SHIFT4_MODE="live"
SHIFT4_PUBLIC_KEY="pk_live_YOUR_LIVE_KEY"
SHIFT4_SECRET_KEY="sk_live_YOUR_LIVE_SECRET"
SHIFT4_ACCOUNT_ID="YOUR_ACCOUNT_ID"

# Shift4 Webhooks
SHIFT4_WEBHOOK_URL="https://yourdomain.com/api/v1/webhooks/shift4"
SHIFT4_WEBHOOK_SIGNING_SECRET="whsec_YOUR_SIGNING_SECRET"

# UTG Configuration (Production)
UTG_ENABLED="true"
UTG_HOST="10.0.1.100"  # Production UTG server
UTG_PORT="8333"
UTG_API_TERMINAL_ID="PROD_TERMINAL_ID"

# Security (Generate new secrets!)
JWT_SECRET="generate-new-strong-secret-for-production"
ADMIN_PASSWORD="generate-strong-password"

# Logging
LOG_LEVEL="info"  # Less verbose for production

# Network Security
ALLOWED_SHIFT4_IPS="52.24.184.0/21,34.223.64.0/20"  # Update with current ranges
```

2. **Production Database**

```bash
# Create production database
createdb shift4_payments_production

# Run migrations
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# DO NOT seed production database with test data
```

3. **SSL/TLS Configuration**

```bash
# Obtain SSL certificate (Let's Encrypt example)
certbot certonly --nginx -d yourdomain.com

# Update nginx configuration
# See nginx.conf for HTTPS setup
```

### 1.3 Infrastructure Updates

1. **Update nginx Configuration**

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Strong SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

2. **Firewall Configuration**

```bash
# Allow only necessary ports
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH (from specific IPs only)

# Whitelist Shift4 webhook IPs
# Get current IP ranges from Shift4 documentation
ufw allow from 52.24.184.0/21 to any port 443
ufw allow from 34.223.64.0/20 to any port 443
```

3. **Monitoring Setup**

```bash
# Set up log aggregation
# Configure application monitoring (e.g., Sentry, DataDog)
# Set up uptime monitoring
# Configure alerts for:
# - Payment failures
# - Webhook processing errors
# - Database issues
# - High error rates
```

## Phase 2: Deployment

### 2.1 Build Production Docker Image

```bash
# Build production image
docker build -t shift4-platform:latest .

# Tag for registry
docker tag shift4-platform:latest your-registry.com/shift4-platform:v1.0.0

# Push to registry
docker push your-registry.com/shift4-platform:v1.0.0
```

### 2.2 Deploy to Production

```bash
# Pull latest image on production server
docker pull your-registry.com/shift4-platform:v1.0.0

# Stop existing containers
docker-compose down

# Start with production config
docker-compose -f docker-compose.production.yml up -d

# Verify containers are running
docker-compose ps
```

### 2.3 Health Checks

```bash
# Check application health
curl https://yourdomain.com/health

# Check database connection
docker-compose exec app npx prisma db execute --stdin < "SELECT 1"

# Check logs for errors
docker-compose logs -f app
```

## Phase 3: Validation

### 3.1 Smoke Tests

1. **Basic Functionality**
   - [ ] Homepage loads correctly
   - [ ] Admin panel accessible
   - [ ] API endpoints responding
   - [ ] Database queries working

2. **Payment Flow (use real card with $0.50 test)**
   - [ ] Navigate to checkout
   - [ ] Enter real payment card
   - [ ] Submit payment for $0.50
   - [ ] Verify charge in Shift4 dashboard (Live mode)
   - [ ] Verify payment in application database
   - [ ] Verify webhook received and processed
   - [ ] Refund the test payment
   - [ ] Verify refund in Shift4 dashboard
   - [ ] Verify refund in application

3. **Terminal Validation (if applicable)**
   - [ ] Ping all production terminals
   - [ ] Run $0.01 test transaction on each terminal
   - [ ] Verify transactions in database
   - [ ] Test refund on terminal

### 3.2 Webhook Validation

```bash
# Monitor webhook logs
docker-compose logs -f app | grep webhook

# Check webhook events in database
npx prisma studio
# Navigate to WebhookEvent model
# Verify events are being received and processed
```

### 3.3 Performance Validation

```bash
# Monitor response times
# Check database query performance
# Verify no memory leaks
# Monitor CPU usage
```

## Phase 4: Go-Live

### 4.1 Update Frontend

1. **Update Client Configuration**
   - Ensure production public key is used
   - Verify all API endpoints point to production
   - Remove test mode indicators

2. **Deploy Frontend Updates**
   ```bash
   npm run build
   # Deploy static assets to CDN
   ```

### 4.2 Enable Live Mode

1. **Update Environment Variable**
   ```env
   SHIFT4_MODE="live"
   ```

2. **Restart Application**
   ```bash
   docker-compose restart app
   ```

3. **Verify Mode**
   - Check logs for "Shift4 live mode enabled"
   - Verify API uses live keys

### 4.3 Communication

1. **Internal Team**
   - Notify team that live mode is active
   - Share monitoring dashboard
   - Establish support rotation

2. **Customers**
   - Announce payment system is live
   - Provide support contact
   - Monitor for issues

## Phase 5: Post-Cutover

### 5.1 Monitoring (First 24 Hours)

- [ ] Monitor all transactions in real-time
- [ ] Check webhook processing rates
- [ ] Monitor error rates
- [ ] Review application logs
- [ ] Check database performance
- [ ] Monitor server resources
- [ ] Verify refunds are processing
- [ ] Check payout reconciliation

### 5.2 First Week Tasks

- [ ] Daily review of transaction reports
- [ ] Compare Shift4 dashboard with application records
- [ ] Reconcile all payouts
- [ ] Review and address any errors
- [ ] Optimize based on real-world usage
- [ ] Update documentation based on learnings

### 5.3 Ongoing Maintenance

**Daily:**
- Review transaction logs
- Monitor webhook events
- Check for failed payments
- Review error logs

**Weekly:**
- Reconcile payouts
- Review dispute/chargeback activity
- Check terminal connectivity
- Update dependencies (security patches)

**Monthly:**
- Full payout reconciliation
- Review performance metrics
- Security audit
- Backup verification
- Update Shift4 IP whitelist if changed

## Rollback Plan

If critical issues arise:

### 5.4 Emergency Rollback

1. **Switch Back to Test Mode**
   ```bash
   # Update environment variable
   SHIFT4_MODE="test"

   # Restart application
   docker-compose restart app
   ```

2. **Restore Previous Version**
   ```bash
   # Pull previous image
   docker pull your-registry.com/shift4-platform:v0.9.0

   # Deploy previous version
   docker-compose down
   docker-compose up -d
   ```

3. **Database Rollback** (if needed)
   ```bash
   # Restore from backup
   pg_restore -d shift4_payments_production backup.dump
   ```

4. **Communication**
   - Notify stakeholders immediately
   - Post status update
   - Schedule post-mortem

## Support Contacts

**Shift4 Support:**
- Email: support@shift4.com
- Phone: 1-888-276-2108
- Portal: support.shift4.com

**Emergency Contacts:**
- Dev Team Lead: [contact]
- Infrastructure: [contact]
- Business Owner: [contact]

## Checklist Summary

Before going live, confirm:

- [ ] Live API keys configured
- [ ] Production database migrated
- [ ] SSL certificate installed
- [ ] Webhooks configured for production
- [ ] Firewall rules updated
- [ ] Monitoring enabled
- [ ] Smoke tests passed
- [ ] $0.50 test charge successful and refunded
- [ ] Team notified and trained
- [ ] Documentation updated
- [ ] Rollback plan reviewed
- [ ] Support contacts documented

## Post-Launch Success Criteria

Within first week:
- [ ] 100% webhook processing success rate
- [ ] < 1% payment failure rate (excluding card declines)
- [ ] All payouts reconciled correctly
- [ ] No critical bugs reported
- [ ] Response times < 500ms average
- [ ] Zero downtime incidents

Congratulations on your production launch! 🎉
