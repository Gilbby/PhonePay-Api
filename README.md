# PhonePay API

Backend API for PhonePay — a multi-wallet mobile money aggregator for Zambia.

## Stack
- Node.js + Express
- TypeScript
- MongoDB (Mongoose)
- JWT Authentication
- Africa's Talking (SMS/OTP)

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Fill in your values in `.env`.

### 3. Set up MongoDB Atlas
- Create a free cluster at https://mongodb.com
- Get your connection string
- Add it to `MONGODB_URI` in `.env`

### 4. Run in development
```bash
npm run dev
```

The server starts on `http://localhost:3000`.
In development, OTPs are logged to the console instead of sent via SMS.

## API Endpoints

### Auth
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/auth/check-phone` | Check if phone is new or returning user | No |
| POST | `/api/auth/send-otp` | Send OTP to phone number | No |
| POST | `/api/auth/verify-otp` | Verify OTP, returns JWT | No |
| POST | `/api/auth/create-alias` | Set alias for new user | Yes |

### Wallets
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/wallets` | Get all user wallets | Yes |
| POST | `/api/wallets` | Add a new wallet | Yes |
| PATCH | `/api/wallets/:id/primary` | Set wallet as primary | Yes |
| DELETE | `/api/wallets/:id` | Remove a wallet | Yes |

### Transactions
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/transactions` | Get transaction history | Yes |
| POST | `/api/transactions/send` | Send money | Yes |
| POST | `/api/transactions/cash-out` | Get Cash via agent | Yes |

## Project Structure
```
src/
├── config/
│   └── db.ts               # MongoDB connection
├── controllers/
│   ├── authController.ts   # Auth logic
│   ├── walletController.ts # Wallet logic
│   └── transactionController.ts # Transaction logic
├── middleware/
│   └── auth.ts             # JWT protection middleware
├── models/
│   ├── User.ts             # User schema
│   ├── Wallet.ts           # Wallet schema
│   └── Transaction.ts      # Transaction schema
├── routes/
│   ├── auth.ts
│   ├── wallets.ts
│   └── transactions.ts
└── index.ts                # Entry point
```

## Phase Roadmap
- **Phase 2 (Current)** — Auth, Users, Wallets, Transactions (mock payments)
- **Phase 3** — pawaPay integration (deposits, webhooks, payouts)
- **Phase 4** — Agent system, commission logic
- **Phase 5** — Security hardening, deployment to DigitalOcean
