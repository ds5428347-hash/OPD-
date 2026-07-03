/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SqlTable {
  name: string;
  description: string;
  columns: { name: string; type: string; constraints: string; description: string }[];
  sql: string;
}

export const sqlTables: SqlTable[] = [
  {
    name: 'users',
    description: 'Core user profiles containing authentication credentials, mobile identifiers, and onboarding details.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Unique identifier for the user' },
      { name: 'mobile_number', type: 'VARCHAR(15)', constraints: 'UNIQUE NOT NULL', description: 'Verified mobile number used for OTP login' },
      { name: 'full_name', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Legal name of the user' },
      { name: 'email', type: 'VARCHAR(255)', constraints: 'UNIQUE', description: 'Optional email address' },
      { name: 'avatar_url', type: 'TEXT', constraints: '', description: 'Profile avatar URI' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'DEFAULT CURRENT_TIMESTAMP', description: 'Record registration timestamp' }
    ],
    sql: `CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_number VARCHAR(15) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    name: 'subscriptions',
    description: 'User healthcare and OPD subscription plan ties with active eligibility durations.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Subscription record identifier' },
      { name: 'user_id', type: 'UUID', constraints: 'REFERENCES users(id) ON DELETE CASCADE', description: 'Associated user ID' },
      { name: 'plan_name', type: 'VARCHAR(50)', constraints: 'NOT NULL', description: 'Bronze (₹29), Silver (₹99), or Gold (₹999)' },
      { name: 'amount', type: 'NUMERIC(10,2)', constraints: 'NOT NULL', description: 'Plan price amount' },
      { name: 'opd_limit', type: 'INTEGER', constraints: 'NOT NULL', description: 'Total claimable OPD times allowed' },
      { name: 'opd_remaining', type: 'INTEGER', constraints: 'NOT NULL', description: 'Remaining valid OPD claims' },
      { name: 'status', type: 'VARCHAR(20)', constraints: 'DEFAULT \'active\'', description: 'active, expired, or cancelled' },
      { name: 'start_date', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'DEFAULT CURRENT_TIMESTAMP', description: 'Subscription activation date' },
      { name: 'end_date', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'NOT NULL', description: 'Subscription expiration date' }
    ],
    sql: `CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_name VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  opd_limit INTEGER NOT NULL,
  opd_remaining INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT chk_opd CHECK (opd_remaining >= 0 AND opd_remaining <= opd_limit)
);`
  },
  {
    name: 'payments',
    description: 'Financial logs recording transactional tokens, gateway interactions (Razorpay), and receipt states.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Primary payment reference ID' },
      { name: 'user_id', type: 'UUID', constraints: 'REFERENCES users(id)', description: 'User making the transaction' },
      { name: 'razorpay_order_id', type: 'VARCHAR(100)', constraints: 'UNIQUE', description: 'Razorpay order ID reference' },
      { name: 'razorpay_payment_id', type: 'VARCHAR(100)', constraints: 'UNIQUE', description: 'Razorpay payment receipt ID' },
      { name: 'amount', type: 'NUMERIC(10,2)', constraints: 'NOT NULL', description: 'Transaction monetary value' },
      { name: 'status', type: 'VARCHAR(20)', constraints: 'NOT NULL', description: 'created, captured, failed, or refunded' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'DEFAULT CURRENT_TIMESTAMP', description: 'Payment event timestamp' }
    ],
    sql: `CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  razorpay_order_id VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100) UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    name: 'claims',
    description: 'OPD claims filed by subscribers for healthcare bill reimbursements.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Unique identifier for the claim' },
      { name: 'user_id', type: 'UUID', constraints: 'REFERENCES users(id)', description: 'Claimant user ID' },
      { name: 'hospital_id', type: 'UUID', constraints: 'REFERENCES hospitals(id)', description: 'Hospital where OPD occurred' },
      { name: 'bill_amount', type: 'NUMERIC(10,2)', constraints: 'NOT NULL', description: 'Original hospital bill amount' },
      { name: 'claim_amount', type: 'NUMERIC(10,2)', constraints: 'NOT NULL', description: 'Claimed reimbursement amount' },
      { name: 'receipt_url', type: 'TEXT', constraints: 'NOT NULL', description: 'Uploaded invoice/slip file URI' },
      { name: 'status', type: 'VARCHAR(20)', constraints: 'DEFAULT \'pending\'', description: 'pending, approved, or rejected' },
      { name: 'rejection_reason', type: 'TEXT', constraints: '', description: 'Optional feedback on rejection' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'DEFAULT CURRENT_TIMESTAMP', description: 'Claim filing timestamp' }
    ],
    sql: `CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  hospital_id UUID REFERENCES hospitals(id),
  bill_amount NUMERIC(10,2) NOT NULL,
  claim_amount NUMERIC(10,2) NOT NULL,
  receipt_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    name: 'hospitals',
    description: 'Empanelled healthcare facilities eligible for quick claim validation and fast OPD check-ins.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Hospital entity ID' },
      { name: 'name', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Commercial name of the medical institution' },
      { name: 'address', type: 'TEXT', constraints: 'NOT NULL', description: 'Physical address' },
      { name: 'contact_number', type: 'VARCHAR(15)', constraints: '', description: 'Institutional contact hotline' },
      { name: 'city', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Metropolitan region' }
    ],
    sql: `CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  address TEXT NOT NULL,
  contact_number VARCHAR(15),
  city VARCHAR(100) NOT NULL
);`
  },
  {
    name: 'diet_plans',
    description: 'Personalized wellness schedules generated by the Gemini engine based on anthropomorphic statistics.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Plan identifier' },
      { name: 'user_id', type: 'UUID', constraints: 'REFERENCES users(id) ON DELETE CASCADE', description: 'Subscriber user ID' },
      { name: 'goal', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Weight loss, gain, or muscle building' },
      { name: 'dietary_type', type: 'VARCHAR(50)', constraints: 'NOT NULL', description: 'Vegetarian, Vegan, or Non-Vegetarian' },
      { name: 'daily_calories', type: 'INTEGER', constraints: 'NOT NULL', description: 'Target calorie count' },
      { name: 'plan_data', type: 'JSONB', constraints: 'NOT NULL', description: 'Complete structured meals JSON' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'DEFAULT CURRENT_TIMESTAMP', description: 'Generation timestamp' }
    ],
    sql: `CREATE TABLE diet_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal VARCHAR(100) NOT NULL,
  dietary_type VARCHAR(50) NOT NULL,
  daily_calories INTEGER NOT NULL,
  plan_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    name: 'ai_chats',
    description: 'Synchronized chat dialog logs with the AI medical wellness assistant.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PRIMARY KEY DEFAULT gen_random_uuid()', description: 'Chat message ID' },
      { name: 'user_id', type: 'UUID', constraints: 'REFERENCES users(id) ON DELETE CASCADE', description: 'User context ID' },
      { name: 'role', type: 'VARCHAR(10)', constraints: 'NOT NULL', description: 'user or assistant' },
      { name: 'message', type: 'TEXT', constraints: 'NOT NULL', description: 'Text message string' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'DEFAULT CURRENT_TIMESTAMP', description: 'Timestamp' }
    ],
    sql: `CREATE TABLE ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`
  }
];
