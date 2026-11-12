# Split Shelf

**Split Shelf** is a full-stack household inventory and restock management application designed for roommates and shared living spaces. It tracks communal groceries, toiletries, and cleaning supplies, automatically rotates restocking turns so everyone buys fairly, predicts when items will run dry, and logs shared expenses without conflict.

---

## What Problem Does It Solve?

In shared apartments and flats, roommates often struggle with communal restocking:
- *"Who finished the milk/detergent?"*
- *"Whose turn is it to buy dish soap?"*
- *"Did someone already buy eggs today?"*
- *"How much did we spend on household supplies this month?"*

Split Shelf solves this by providing a single real-time communal dashboard where roommates can see shelf levels, log purchases with prices and notes, get notified when it's their turn, and review clear expense histories.

---

## Key Features

- **Real-Time Communal Shelf**: Visual board organizing products into **Urgent / Running Low** and **In Stock** sections with live automatic background refresh.
- **Fair-Turn Engine**: An automated round-robin algorithm that tracks purchase counts and restock history, assigning the next purchase to whoever has bought least or earliest.
- **Run-Out Forecasting**: Linear interval prediction that calculates consumption rates based on past restock dates to estimate the exact day an item will run out.
- **"I Bought This" Restock Logger**: Quick slide-over drawer to log restock purchases with quantity, date, unit price (₹), and optional receipts/notes.
- **Low Stock Reporting**: Anyone can mark a product running low with remaining units and notes, immediately notifying the assigned buyer.
- **Purchase History Feed**:
  - Paginated feed (10 records per page) with structured columns: S.No, Date, Product Name, Quantity, Unit, Buyer, and Price.
  - Member drilldown page with tabbed product filters and total spend summaries.
- **Household & Admin Management**:
  - Secure alphanumeric invite codes for easy roommate onboarding.
  - Role-based permissions (Admin vs. Member).
  - Admin controls for product management with cascading deletion of logs.
  - Safe admin departure flow (reassign another member as Admin or delete household).
- **Notifications Center**: Header notification bell with live unread badge polling for low stock alerts and restock announcements.
- **Dark & Light Mode**: Accessible theme toggle with custom CSS design tokens.

---

## Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Routing**: React Router v6
- **State Management**: React Context (`AuthContext`, `HouseholdContext`, `NotificationContext`, `ConfirmContext`)
- **HTTP Client**: Axios with JWT authentication interceptors
- **Styling**: Vanilla CSS with customized design tokens and responsive layouts

### Backend
- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod (strict request payload validation)
- **Security**: JWT (JSON Web Tokens), Bcrypt (password hashing), Helmet (HTTP headers), Express Rate Limit

---

## Project Structure

```text
splitshelf/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── api/                # Axios endpoints (auth, households, items, history, notifications)
│   │   ├── components/         # UI components, modals, sidebar, item cards, slide-over drawer
│   │   ├── context/            # React context providers (Auth, Household, Notifications, Confirm)
│   │   ├── hooks/              # Custom hooks (useAuth, useHousehold, useItems, etc.)
│   │   ├── pages/              # Top-level views (Home, History, PersonHistory, Admin, Login, Register, Onboarding)
│   │   ├── styles/             # Global CSS design tokens & responsive themes
│   │   └── utils/              # Formatting, unit sanitation, color hashing helpers
│   ├── index.html              # HTML entry point
│   ├── package.json
│   └── vite.config.js
│
└── server/                     # Backend API Service
    └── src/
        ├── config/             # MongoDB connection & environment variable validation
        ├── controllers/        # Express route request handlers
        ├── jobs/               # Background cron jobs (e.g. 24h stale low-stock reminder)
        ├── middleware/         # JWT verification, household membership checks, rate limiting, error handling
        ├── models/             # Mongoose schemas (User, Household, Item, RestockLog, Notification, JobLock)
        ├── routes/             # REST API endpoint definitions
        ├── services/           # Core domain logic (item management, fair-turn algorithm, forecast predictor)
        ├── utils/              # Error classes, async wrappers, invite code generator, job lock
        ├── validators/         # Zod validation schemas
        ├── app.js              # Express app setup and middleware pipeline
        └── server.js           # Server entry point
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [MongoDB](https://www.mongodb.com/) (local instance or MongoDB Atlas URI)

### 1. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in `server/` with:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/splitshelf
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:5173
```

Start the backend:
```bash
npm run dev
```
The server will run on `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd ../client
npm install
```

Create a `.env` file in `client/` with:
```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## License

ISC
