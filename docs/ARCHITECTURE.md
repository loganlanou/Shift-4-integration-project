# Architecture Overview

## System Architecture

```mermaid
graph TB
    subgraph "Frontend - Next.js 15"
        UI[User Interface]
        Checkout[Checkout Pages]
        Admin[Admin Dashboard]
    end

    subgraph "Shift4 Client-Side"
        S4JS[Shift4 JS Components]
        Token[Token Generation]
    end

    subgraph "Backend API - Next.js API Routes"
        API[API Routes /api/v1]
        CheckoutAPI[Checkout Endpoints]
        TerminalAPI[Terminal Endpoints]
        WebhookAPI[Webhook Receiver]
        AdminAPI[Admin Endpoints]
    end

    subgraph "Payment Module"
        PaymentCore[Payment Abstractions]
        S4Adapter[Shift4 Online Adapter]
        UTGAdapter[UTG Terminal Adapter]
        SkyTabAdapter[SkyTab Terminal Adapter]
    end

    subgraph "External Services"
        S4API[Shift4 REST API]
        UTG[UTG Server]
        SkyTab[SkyTab API]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL)]
        Prisma[Prisma ORM]
    end

    UI --> Checkout
    UI --> Admin
    Checkout --> S4JS
    S4JS --> Token
    Token --> CheckoutAPI
    CheckoutAPI --> API
    Admin --> TerminalAPI
    Admin --> AdminAPI

    API --> PaymentCore
    PaymentCore --> S4Adapter
    PaymentCore --> UTGAdapter
    PaymentCore --> SkyTabAdapter

    S4Adapter --> S4API
    UTGAdapter --> UTG
    SkyTabAdapter --> SkyTab

    S4API -.Webhooks.-> WebhookAPI
    WebhookAPI --> API

    API --> Prisma
    Prisma --> DB
```

## Online Payment Flow

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS
    participant Shift4JS as Shift4 JS Components
    participant Backend
    participant Shift4Adapter
    participant Shift4API as Shift4 REST API
    participant DB

    Browser->>NextJS: Navigate to /checkout
    NextJS->>Backend: POST /api/v1/checkout/online/intent
    Backend->>DB: Create Order (DRAFT)
    Backend-->>NextJS: Return {orderId, publicKey}
    NextJS->>Shift4JS: Initialize with publicKey
    Shift4JS-->>Browser: Render card form

    Browser->>Shift4JS: Enter card details
    Browser->>Shift4JS: Submit form
    Shift4JS->>Shift4API: createToken() [PAN never hits server]
    Shift4API-->>Shift4JS: Return token

    Shift4JS->>Backend: POST /api/v1/checkout/online/confirm<br/>{orderId, token}
    Backend->>Shift4Adapter: createCharge(token, amount)
    Shift4Adapter->>Shift4API: POST /charges
    Shift4API-->>Shift4Adapter: Charge response
    Shift4Adapter-->>Backend: {chargeId, status}
    Backend->>DB: Create Payment (CAPTURED)
    Backend->>DB: Update Order (PAID)
    Backend-->>Browser: Payment receipt

    Note over Shift4API,Backend: Async webhook events
    Shift4API->>Backend: POST /api/v1/webhooks/shift4<br/>charge.succeeded
    Backend->>DB: Update payment status
```

## Terminal Payment Flow

```mermaid
sequenceDiagram
    participant Admin
    participant Backend
    participant TerminalAdapter
    participant Terminal as UTG/SkyTab
    participant DB

    Admin->>Backend: POST /api/v1/checkout/terminal/pay<br/>{terminalId, orderId, amount}
    Backend->>DB: Verify terminal & order
    Backend->>TerminalAdapter: startPayment(options)
    TerminalAdapter->>Terminal: Initiate transaction
    Backend-->>Admin: {transactionId, status: pending}

    Admin->>Backend: Poll GET /checkout/terminal/status/{transactionId}
    Backend->>DB: Query transaction status
    Backend-->>Admin: {status: pending}

    Terminal-->>TerminalAdapter: Payment approved
    TerminalAdapter->>DB: Create TerminalTransaction
    TerminalAdapter->>DB: Create Payment (CAPTURED)
    TerminalAdapter->>DB: Update Order (PAID)

    Admin->>Backend: Poll GET /checkout/terminal/status/{transactionId}
    Backend->>DB: Query transaction
    Backend-->>Admin: {status: approved, result}
```

## Webhook Processing Flow

```mermaid
sequenceDiagram
    participant Shift4
    participant WebhookAPI
    participant Processor
    participant Shift4Adapter
    participant DB

    Shift4->>WebhookAPI: POST /webhooks/shift4<br/>{eventId, type, data}
    WebhookAPI->>DB: Check if already processed

    alt Already processed
        WebhookAPI-->>Shift4: 200 OK (idempotent)
    else New event
        WebhookAPI->>DB: Store webhook_event
        WebhookAPI-->>Shift4: 200 OK (immediate ack)

        Note over WebhookAPI,Processor: Async processing
        Processor->>Shift4Adapter: Fetch full event (best practice)
        Shift4Adapter->>Shift4: GET /events/{eventId}
        Shift4-->>Shift4Adapter: Full event data

        alt charge.succeeded
            Processor->>DB: Update payment status
        else charge.refunded
            Processor->>DB: Update payment & refund
        else charge.dispute.created
            Processor->>DB: Create dispute record
        else payout.paid
            Processor->>DB: Create/update payout
        end

        Processor->>DB: Mark webhook processed
    end
```

## Database Schema

```mermaid
erDiagram
    User ||--o{ Order : places
    User ||--o| Customer : has
    Customer ||--o{ Payment : makes
    Order ||--o{ Payment : has
    Order ||--o{ Refund : has
    Order ||--o{ Dispute : has
    Payment ||--o{ Refund : has
    Terminal ||--o{ Payment : processes
    Terminal ||--o{ TerminalTransaction : logs
    Payout ||--o{ PayoutLine : contains

    User {
        string id PK
        string email UK
        string name
        timestamp createdAt
    }

    Customer {
        string id PK
        string userId FK
        string shift4CustomerId UK
        string defaultCardToken
        string cardBrand
        string cardLast4
    }

    Order {
        string id PK
        string orderNumber UK
        string userId FK
        enum status
        int total
        int refundedTotal
        json items
        timestamp createdAt
    }

    Payment {
        string id PK
        string orderId FK
        string shift4ChargeId UK
        int amount
        enum status
        enum methodType
        string cardBrand
        string cardLast4
        string terminalId FK
        string authCode
        timestamp capturedAt
    }

    Terminal {
        string id PK
        string name
        enum type
        string apiTerminalId UK
        string ipAddress
        int port
        enum status
        json config
    }

    Refund {
        string id PK
        string orderId FK
        string paymentId FK
        string shift4RefundId UK
        int amount
        enum status
        timestamp processedAt
    }

    Dispute {
        string id PK
        string orderId FK
        string shift4DisputeId UK
        int amount
        enum status
        timestamp evidenceDeadline
    }

    Payout {
        string id PK
        string shift4PayoutId UK
        int amount
        enum status
        timestamp arrivalDate
        boolean reconciled
    }
```

## Component Structure

```
src/
├── app/                    # Next.js 15 App Router
│   ├── page.tsx           # Homepage
│   ├── checkout/          # Checkout pages
│   ├── admin/             # Admin dashboard
│   └── api/v1/            # API routes
│       ├── checkout/      # Checkout endpoints
│       ├── terminals/     # Terminal management
│       ├── refunds/       # Refund endpoints
│       ├── webhooks/      # Webhook receiver
│       └── payouts/       # Payout endpoints
├── payments/              # Payment module (core)
│   ├── types.ts          # Type definitions
│   ├── errors.ts         # Custom errors
│   ├── logger.ts         # Logging utilities
│   └── adapters/         # Payment adapters
│       ├── shift4-adapter.ts    # Online payments
│       ├── utg-adapter.ts       # UTG terminals
│       └── skytab-adapter.ts    # SkyTab terminals
├── lib/                   # Shared utilities
│   ├── db.ts             # Prisma client
│   └── api-utils.ts      # API helpers
└── components/            # React components
    └── ...
```

## Security Architecture

### PCI Compliance
- **No PAN Storage**: Card numbers never touch the server (Shift4 JS Components tokenization)
- **Token-Based**: All payments use tokens from Shift4
- **P2PE Terminals**: UTG/SkyTab handle encryption at point of interaction

### API Security
- Environment-based secrets (`.env`)
- Idempotency keys for payment operations
- Webhook signature verification (if enabled by Shift4)
- Network IP whitelisting for webhooks

### Data Security
- PostgreSQL with encrypted connections
- Audit logging for all payment operations
- PII redaction in application logs
- Separate test/live mode configurations

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        LB[Load Balancer / Nginx]
        App1[Next.js App Instance 1]
        App2[Next.js App Instance 2]
        DB[(PostgreSQL Primary)]
        DBReplica[(PostgreSQL Replica)]
        Redis[(Redis Cache)]
    end

    subgraph "External"
        Shift4[Shift4 API]
        UTG[UTG on LAN]
        Monitoring[Monitoring/Logs]
    end

    LB --> App1
    LB --> App2
    App1 --> DB
    App2 --> DB
    App1 --> Redis
    App2 --> Redis
    DB --> DBReplica

    App1 --> Shift4
    App2 --> Shift4
    App1 --> UTG
    App2 --> UTG

    App1 --> Monitoring
    App2 --> Monitoring
```

## Scaling Considerations

1. **Horizontal Scaling**: Multiple Next.js instances behind load balancer
2. **Database**: Read replicas for reporting queries
3. **Caching**: Redis for session data and frequently accessed data
4. **Queue**: Background job processing for webhooks (BullMQ, Inngest)
5. **CDN**: Static assets via CDN
6. **Monitoring**: Application performance monitoring (APM)
