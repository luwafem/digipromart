# DigiPromart - Multi-Vendor Digital Goods Marketplace

A zero-budget, fully automated marketplace for digital products (social media accounts, phone numbers, bank accounts, API services) with Paystack payments and instant delivery.

## Technology Stack

- **Build Tool**: Parcel (zero-configuration)
- **Frontend**: React (JavaScript), Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Payments**: Paystack (inline popup, webhooks, Transfers API)
- **Hosting**: Netlify (auto-deploy from GitHub)

## Features

- **User Roles**: Customers, Suppliers, Admins
- **Product Management**: Create products with custom attributes and inventory
- **Instant Delivery**: Credentials delivered immediately after payment
- **Automated Payouts**: Suppliers receive 80% of product price automatically
- **Admin Panel**: Full oversight with dashboard, user management, order management

## Business Rules

- **Customer pays**: product_price + ₦500 (fixed platform fee)
- **Supplier receives**: product_price × 0.8 (80% of product price)
- **Platform retains**: ₦500 + (product_price × 0.2)

## Prerequisites

1. Node.js 18+
2. Supabase account (free tier)
3. Paystack account (for real payments)
4. Netlify account (for hosting)

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd digipromart
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Supabase (required)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Paystack (optional - payments work in demo mode without these)
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

### 4. Set up Supabase

a. Create a new Supabase project at https://supabase.com

b. Run the database schema:
   - Go to Supabase Dashboard > SQL Editor
   - Copy the contents of `supabase/schema.sql` and run it

c. Get your credentials:
   - Project Settings > API > URL (use as VITE_SUPABASE_URL)
   - Project Settings > API > anon public key (use as VITE_SUPABASE_ANON_KEY)

d. Create an admin user:
   - Sign up as a supplier
   - In Supabase Dashboard, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
   ```

### 5. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy initialize-payment
supabase functions deploy verify-payment
supabase functions deploy create-recipient
supabase functions deploy initiate-payout
```

Set the following secrets in Supabase:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set PAYSTACK_SECRET_KEY=your_paystack_secret_key
```

## Run Locally

```bash
npm start
```

Visit http://localhost:1234

## Deploy to Netlify

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Set the environment variables in Netlify dashboard
4. Deploy!

Your site will be available at `https://your-netlify-site.netlify.app`

## Test Payments/Webhooks

### Demo Mode
Without Paystack keys, the app runs in demo mode:
- Payments are simulated (no real money transfers)
- Payouts are marked as completed without real transfers

### Real Payments
1. Add your Paystack keys to environment variables
2. Configure Paystack webhook URL in your Paystack dashboard:
   ```
   https://yourdomain.com/functions/v1/verify-payment
   ```

## Project Structure

```
digipromart/
├── src/
│   ├── components/
│   │   ├── Auth.jsx         # Login, Signup, Logout
│   │   ├── Profile.jsx      # User profile management
│   │   ├── SupplierProducts.jsx  # Product & inventory management
│   │   ├── Storefront.jsx  # Customer product browsing
│   │   ├── Checkout.jsx    # Payment flow
│   │   ├── CustomerVault.jsx  # Purchased items
│   │   └── AdminPanel.jsx  # Admin dashboard
│   ├── index.jsx           # Main App component
│   ├── index.html          # Entry point
│   ├── styles.css          # Tailwind CSS
│   └── supabase.js         # Supabase client config
├── supabase/
│   ├── schema.sql          # Database schema
│   └── functions/         # Edge Functions
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Database Schema

Key tables:
- `profiles` - User profiles with roles
- `platforms` - Product platforms (Instagram, WhatsApp, etc.)
- `products` - Products listed by suppliers
- `inventory_items` - Individual sellable items with credentials
- `orders` - Customer orders
- `order_items` - Items in each order
- `payouts` - Supplier payouts
- `logs` - Event logging
- `settings` - Platform configuration

## License

MIT 
