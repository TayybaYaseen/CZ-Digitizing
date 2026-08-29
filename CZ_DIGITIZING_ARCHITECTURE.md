# CZ Digitizing - Technical Architecture

**Version:** 1.0  
**Last Updated:** August 2026  
**Project:** CZ Digitizing E-Commerce Platform + Mobile App + Admin Panel  
**Domain:** czdigitizing.com

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [API Architecture](#api-architecture)
6. [Authentication & Security](#authentication--security)
7. [File Management](#file-management)
8. [Payment Processing](#payment-processing)
9. [Notifications System](#notifications-system)
10. [Deployment Architecture](#deployment-architecture)
11. [Performance & Optimization](#performance--optimization)

---

## System Overview

CZ Digitizing is a **multi-platform e-commerce and service management system** for machine embroidery designs, digitizing services, and custom requests. The platform consists of three main applications sharing a single backend:

- **Public Website** (Responsive Web)
- **Mobile App** (iOS + Android)
- **Admin Panel** (Protected Web Portal)

All applications communicate via a unified REST/GraphQL API backed by a secure database.

### Core Business Functions

- Sell pre-made embroidery designs and design bundles
- Sell subscriptions and credit packages
- Offer embroidery digitizing and vector art services
- Accept custom design requests
- Manage quotes and orders
- Provide customer support via FAQs, tips, and Taebo chatbot
- Manage multilingual content (15 languages)

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├──────────────────┬──────────────────┬──────────────────────┤
│  Public Website  │  Mobile App      │  Admin Portal        │
│  (Next.js/React) │ (React Native)   │ (React Dashboard)    │
└──────────────────┴──────────────────┴──────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  API & Service Layer                         │
├──────────────────────────────────────────────────────────────┤
│  REST API / GraphQL                                          │
│  - Authentication Service                                   │
│  - Design Management Service                                │
│  - Order & Payment Service                                  │
│  - File Management Service                                  │
│  - User Service                                             │
│  - Notification Service                                     │
│  - Search Service                                           │
│  - FAQ & Knowledge Base Service                             │
│  - Custom Request Service                                   │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Data & Storage Layer                        │
├──────────────────┬──────────────────┬──────────────────────┤
│  PostgreSQL DB   │  File Storage    │  Cache (Redis)       │
│  - Designs       │  - Public Images │  - Sessions          │
│  - Users         │  - Private Files │  - Tokens            │
│  - Orders        │  - Temp Uploads  │  - Search Index      │
│  - Quotes        │  - ZIPs          │                      │
│  - Custom Reqs   │                  │                      │
└──────────────────┴──────────────────┴──────────────────────┘
```

---

## Technology Stack

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 18+ | Server-side JavaScript runtime |
| **Framework** | Express.js / NestJS | REST API server framework |
| **API Alternative** | Apollo Server | GraphQL server (optional) |
| **Database** | PostgreSQL 14+ | Primary relational database |
| **Cache** | Redis 7+ | Session storage, caching, rate limiting |
| **File Storage** | AWS S3 / MinIO | Embroidery files, images, ZIPs |
| **Search** | Elasticsearch / Postgres FTS | Design search, FAQ search |
| **Task Queue** | Bull / RabbitMQ | Email, notifications, file processing |
| **Authentication** | JWT + bcrypt | User session management |
| **ORM** | Prisma / TypeORM | Database abstraction layer |

### Frontend - Public Website

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14+ | React-based SSR/SSG framework |
| **State Management** | Redux Toolkit / Zustand | Global state management |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Animation** | Framer Motion | Smooth animations & transitions |
| **UI Components** | Custom + Shadcn/ui | Design system components |
| **Internationalization** | i18next | Multi-language support |
| **Forms** | React Hook Form + Zod | Form validation & handling |

### Frontend - Mobile App

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React Native / Expo | Cross-platform mobile app |
| **State Management** | Redux Toolkit / Zustand | Global state management |
| **Navigation** | React Navigation | App navigation stack |
| **UI Components** | React Native Paper | Native-looking components |
| **Internationalization** | i18next | Multi-language support |
| **Local Storage** | AsyncStorage | Device-level caching |

### Frontend - Admin Panel

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 18+ | Admin dashboard UI |
| **Admin Kit** | Refine / React-Admin | Admin panel scaffolding |
| **Charts** | Recharts / Chart.js | Data visualization |
| **Tables** | TanStack React Table | Advanced data tables |
| **File Upload** | React Dropzone | File upload UI |
| **Date Handling** | date-fns / Day.js | Date manipulation |

### DevOps & Infrastructure

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Containerization** | Docker | Application containerization |
| **Orchestration** | Docker Compose / Kubernetes | Container management |
| **CI/CD** | GitHub Actions / GitLab CI | Automated testing & deployment |
| **Hosting** | AWS EC2 / DigitalOcean / Vercel | Cloud infrastructure |
| **CDN** | CloudFront / Cloudflare | Content delivery |
| **Monitoring** | Prometheus + Grafana | Performance monitoring |
| **Logging** | ELK Stack / Datadog | Log aggregation |

---

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY DEFAULT nextval('users_id_seq'),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  display_name VARCHAR(255),
  avatar_url TEXT,
  role ENUM('customer', 'admin', 'freelancer', 'moderator'),
  gmail_verified BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active'
);
```

#### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id),
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(6),
  verification_attempts INT DEFAULT 0,
  verification_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Designs Table
```sql
CREATE TABLE designs (
  id BIGINT PRIMARY KEY DEFAULT nextval('designs_id_seq'),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  preview_image_url TEXT NOT NULL,
  category_id BIGINT NOT NULL REFERENCES design_categories(id),
  subcategory_id BIGINT REFERENCES design_subcategories(id),
  price_pkr DECIMAL(10, 2) NOT NULL,
  sale_price_pkr DECIMAL(10, 2),
  discount_badge VARCHAR(100),
  stitch_count INT,
  thread_color_count INT,
  thread_color_changes INT,
  is_published BOOLEAN DEFAULT false,
  created_by_admin_id BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

#### Design Files Table
```sql
CREATE TABLE design_files (
  id BIGINT PRIMARY KEY DEFAULT nextval('design_files_id_seq'),
  design_id BIGINT NOT NULL REFERENCES designs(id),
  file_format ENUM('DST', 'PES', 'JEF', 'EXP', 'VP3', 'EMB'),
  file_url TEXT,
  file_size_bytes BIGINT,
  storage_path TEXT,
  is_private BOOLEAN DEFAULT true,
  upload_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE,
  CONSTRAINT emb_never_public CHECK (NOT (file_format = 'EMB' AND NOT is_private))
);
```

#### Design Sizes Table
```sql
CREATE TABLE design_sizes (
  id BIGINT PRIMARY KEY DEFAULT nextval('design_sizes_id_seq'),
  design_id BIGINT NOT NULL REFERENCES designs(id),
  size_label VARCHAR(50),
  size_width_mm DECIMAL(8, 2),
  size_height_mm DECIMAL(8, 2),
  size_order INT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE
);
```

#### Design Bundles Table
```sql
CREATE TABLE design_bundles (
  id BIGINT PRIMARY KEY DEFAULT nextval('bundles_id_seq'),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  price_pkr DECIMAL(10, 2) NOT NULL,
  sale_price_pkr DECIMAL(10, 2),
  is_published BOOLEAN DEFAULT false,
  created_by_admin_id BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bundle_designs (
  id BIGINT PRIMARY KEY DEFAULT nextval('bundle_designs_id_seq'),
  bundle_id BIGINT NOT NULL REFERENCES design_bundles(id),
  design_id BIGINT NOT NULL REFERENCES designs(id),
  sort_order INT,
  UNIQUE (bundle_id, design_id)
);
```

#### Orders Table
```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY DEFAULT nextval('orders_id_seq'),
  order_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES users(id),
  order_status ENUM('pending', 'payment_pending', 'payment_confirmed', 'processing', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
  payment_method ENUM('paypal', 'bank_transfer', 'credit_card'),
  payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
  subtotal_pkr DECIMAL(12, 2),
  discount_pkr DECIMAL(12, 2),
  credits_used INT DEFAULT 0,
  total_pkr DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'PKR',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT
);
```

#### Order Items Table
```sql
CREATE TABLE order_items (
  id BIGINT PRIMARY KEY DEFAULT nextval('order_items_id_seq'),
  order_id BIGINT NOT NULL REFERENCES orders(id),
  design_id BIGINT REFERENCES designs(id),
  bundle_id BIGINT REFERENCES design_bundles(id),
  quantity INT DEFAULT 1,
  selected_size_id BIGINT REFERENCES design_sizes(id),
  price_at_purchase DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK ((design_id IS NOT NULL AND bundle_id IS NULL) OR (design_id IS NULL AND bundle_id IS NOT NULL))
);
```

#### Customer Files Table
```sql
CREATE TABLE customer_authorized_files (
  id BIGINT PRIMARY KEY DEFAULT nextval('customer_files_id_seq'),
  order_id BIGINT NOT NULL REFERENCES orders(id),
  design_file_id BIGINT NOT NULL REFERENCES design_files(id),
  is_downloaded BOOLEAN DEFAULT false,
  download_count INT DEFAULT 0,
  first_download_at TIMESTAMP,
  last_download_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (design_file_id) REFERENCES design_files(id) ON DELETE CASCADE
);
```

#### Custom Requests Table
```sql
CREATE TABLE custom_requests (
  id BIGINT PRIMARY KEY DEFAULT nextval('custom_requests_id_seq'),
  request_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES users(id),
  request_type ENUM('embroidery_custom', 'vector_custom'),
  status ENUM('new', 'reviewing', 'quote_sent', 'approved', 'in_production', 'ready', 'delivered', 'completed', 'need_more_info', 'revision_required', 'cancelled') DEFAULT 'new',
  image_url TEXT,
  size_value VARCHAR(100),
  machine_format VARCHAR(50),
  fabric_type VARCHAR(100),
  special_instructions TEXT,
  quoted_price_pkr DECIMAL(10, 2),
  final_price_pkr DECIMAL(10, 2),
  payment_status ENUM('pending', 'completed', 'refunded'),
  designer_id BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Quotes Table
```sql
CREATE TABLE quotes (
  id BIGINT PRIMARY KEY DEFAULT nextval('quotes_id_seq'),
  quote_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id BIGINT REFERENCES users(id),
  service_type VARCHAR(100) NOT NULL,
  service_category VARCHAR(100),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_whatsapp VARCHAR(20),
  customer_country VARCHAR(100),
  design_upload_url TEXT,
  required_size VARCHAR(100),
  quantity INT,
  fabric_type VARCHAR(100),
  thread_color_preference TEXT,
  machine_format_preference VARCHAR(50),
  deadline_date DATE,
  special_instructions TEXT,
  status ENUM('new', 'reviewing', 'responded', 'converted_to_order', 'rejected', 'archived') DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Subscriptions Table
```sql
CREATE TABLE subscription_plans (
  id BIGINT PRIMARY KEY DEFAULT nextval('subscription_plans_id_seq'),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  monthly_price_pkr DECIMAL(10, 2),
  yearly_price_pkr DECIMAL(10, 2),
  monthly_credits INT,
  priority_support BOOLEAN DEFAULT false,
  faster_turnaround BOOLEAN DEFAULT false,
  discount_percentage INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  sort_order INT,
  is_best_value BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customer_subscriptions (
  id BIGINT PRIMARY KEY DEFAULT nextval('customer_subscriptions_id_seq'),
  customer_id BIGINT NOT NULL REFERENCES users(id),
  plan_id BIGINT NOT NULL REFERENCES subscription_plans(id),
  billing_period ENUM('monthly', 'yearly'),
  subscription_status ENUM('active', 'paused', 'cancelled', 'expired') DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  renewal_date DATE,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);
```

#### Credits Table
```sql
CREATE TABLE credit_packages (
  id BIGINT PRIMARY KEY DEFAULT nextval('credit_packages_id_seq'),
  credit_amount INT NOT NULL,
  price_pkr DECIMAL(10, 2) NOT NULL,
  bonus_credits INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customer_credits (
  id BIGINT PRIMARY KEY DEFAULT nextval('customer_credits_id_seq'),
  customer_id BIGINT NOT NULL REFERENCES users(id),
  total_credits INT DEFAULT 0,
  used_credits INT DEFAULT 0,
  available_credits INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE credit_transactions (
  id BIGINT PRIMARY KEY DEFAULT nextval('credit_transactions_id_seq'),
  customer_id BIGINT NOT NULL REFERENCES users(id),
  transaction_type ENUM('purchase', 'usage', 'refund', 'adjustment'),
  amount INT NOT NULL,
  order_id BIGINT REFERENCES orders(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### FAQs Table
```sql
CREATE TABLE faqs (
  id BIGINT PRIMARY KEY DEFAULT nextval('faqs_id_seq'),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  topic VARCHAR(100),
  related_page VARCHAR(100),
  related_service VARCHAR(100),
  related_category VARCHAR(100),
  language_code VARCHAR(5) DEFAULT 'en',
  priority INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  taebo_visible BOOLEAN DEFAULT false,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_admin_id BIGINT REFERENCES users(id)
);
```

#### Tips for Embroiderers Table
```sql
CREATE TABLE embroiderer_tips (
  id BIGINT PRIMARY KEY DEFAULT nextval('tips_id_seq'),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  language_code VARCHAR(5) DEFAULT 'en',
  is_published BOOLEAN DEFAULT false,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_admin_id BIGINT REFERENCES users(id)
);
```

#### Testimonials Table
```sql
CREATE TABLE testimonials (
  id BIGINT PRIMARY KEY DEFAULT nextval('testimonials_id_seq'),
  customer_name VARCHAR(255) NOT NULL,
  customer_country VARCHAR(100),
  business_name VARCHAR(255),
  customer_photo_url TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NOT NULL,
  service_used VARCHAR(100),
  is_published BOOLEAN DEFAULT false,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Notifications Table
```sql
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY DEFAULT nextval('notifications_id_seq'),
  recipient_user_id BIGINT NOT NULL REFERENCES users(id),
  notification_type ENUM('order_confirmed', 'payment_received', 'files_ready', 'quote_submitted', 'custom_request_update', 'new_registration', 'admin_alert', 'system_alert'),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_order_id BIGINT REFERENCES orders(id),
  related_quote_id BIGINT REFERENCES quotes(id),
  related_custom_request_id BIGINT REFERENCES custom_requests(id),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY DEFAULT nextval('audit_logs_id_seq'),
  admin_user_id BIGINT REFERENCES users(id),
  action_type VARCHAR(100),
  resource_type VARCHAR(100),
  resource_id VARCHAR(100),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Indexes
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_designs_category ON designs(category_id);
CREATE INDEX idx_designs_published ON designs(is_published);
CREATE INDEX idx_designs_name_search ON designs USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_notifications_user ON notifications(recipient_user_id, is_read);
CREATE INDEX idx_custom_requests_customer ON custom_requests(customer_id);
CREATE INDEX idx_faqs_topic ON faqs(topic);
```

---

## API Architecture

### REST API Endpoints

#### Authentication Endpoints
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/verify-2fa
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/refresh-token
GET    /api/auth/verify-session
POST   /api/auth/verify-new-device
```

#### Designs Endpoints
```
GET    /api/designs
GET    /api/designs/:id
GET    /api/designs/search?q=query
GET    /api/designs/category/:categoryId
GET    /api/designs/subcategory/:subcategoryId
POST   /api/designs (Admin only)
PUT    /api/designs/:id (Admin only)
DELETE /api/designs/:id (Admin only)
POST   /api/designs/:id/favorite
DELETE /api/designs/:id/favorite
GET    /api/designs/:id/sizes
POST   /api/designs/:id/files (Admin only)
DELETE /api/designs/:id/files/:fileId (Admin only)
```

#### Design Categories Endpoints
```
GET    /api/categories
GET    /api/categories/:id
GET    /api/categories/:id/subcategories
POST   /api/categories (Admin only)
PUT    /api/categories/:id (Admin only)
DELETE /api/categories/:id (Admin only)
```

#### Design Bundles Endpoints
```
GET    /api/bundles
GET    /api/bundles/:id
POST   /api/bundles (Admin only)
PUT    /api/bundles/:id (Admin only)
DELETE /api/bundles/:id (Admin only)
POST   /api/bundles/:id/designs (Admin only)
DELETE /api/bundles/:id/designs/:designId (Admin only)
```

#### Orders Endpoints
```
POST   /api/orders
GET    /api/orders/:id
GET    /api/orders/user/history
GET    /api/orders (Admin only)
PUT    /api/orders/:id/status (Admin only)
POST   /api/orders/:id/payment-confirmation (Admin only)
GET    /api/orders/:id/files (Customer only - after payment)
POST   /api/orders/:id/files/:fileId/download
```

#### Shopping Cart Endpoints
```
GET    /api/cart
POST   /api/cart/items
PUT    /api/cart/items/:itemId
DELETE /api/cart/items/:itemId
DELETE /api/cart
POST   /api/cart/checkout
```

#### Custom Requests Endpoints
```
POST   /api/custom-requests
GET    /api/custom-requests/:id
GET    /api/custom-requests/user/history
GET    /api/custom-requests (Admin only)
PUT    /api/custom-requests/:id (Admin only)
POST   /api/custom-requests/:id/quote (Admin only)
POST   /api/custom-requests/:id/files (Admin only - after completion)
```

#### Quotes Endpoints
```
POST   /api/quotes
GET    /api/quotes/:id
GET    /api/quotes/user/history
GET    /api/quotes (Admin only)
PUT    /api/quotes/:id/status (Admin only)
POST   /api/quotes/:id/respond (Admin only)
```

#### File Format Requests Endpoints
```
POST   /api/orders/:orderId/file-format-request
GET    /api/orders/:orderId/file-format-requests
GET    /api/file-format-requests (Admin only)
POST   /api/file-format-requests/:id/fulfill (Admin only)
```

#### Subscriptions Endpoints
```
GET    /api/subscriptions/plans
POST   /api/subscriptions/subscribe
GET    /api/subscriptions/current
PUT    /api/subscriptions/cancel
GET    /api/subscriptions (Admin only)
POST   /api/subscriptions/plans (Admin only)
PUT    /api/subscriptions/plans/:id (Admin only)
```

#### Credits Endpoints
```
GET    /api/credits/packages
GET    /api/credits/balance
POST   /api/credits/purchase
GET    /api/credits/transactions
POST   /api/credits/packages (Admin only)
PUT    /api/credits/packages/:id (Admin only)
```

#### User Account Endpoints
```
GET    /api/users/profile
PUT    /api/users/profile
POST   /api/users/avatar
GET    /api/users/orders
GET    /api/users/quotes
GET    /api/users/custom-requests
GET    /api/users/purchased-designs
```

#### FAQs Endpoints
```
GET    /api/faqs
GET    /api/faqs/search?q=query
GET    /api/faqs?topic=:topic
POST   /api/faqs (Admin only)
PUT    /api/faqs/:id (Admin only)
DELETE /api/faqs/:id (Admin only)
```

#### Testimonials Endpoints
```
GET    /api/testimonials
POST   /api/testimonials (Admin only)
PUT    /api/testimonials/:id (Admin only)
DELETE /api/testimonials/:id (Admin only)
```

#### Taebo Endpoints
```
POST   /api/taebo/chat
GET    /api/taebo/suggestions?page=:page
POST   /api/taebo/mark-waiting (Admin only)
GET    /api/taebo/unanswered (Admin only)
```

#### Admin Dashboard Endpoints
```
GET    /api/admin/dashboard/stats
GET    /api/admin/orders/recent
GET    /api/admin/revenue/monthly
GET    /api/admin/top-designs
GET    /api/admin/customers/recent
```

#### Admin Settings Endpoints
```
GET    /api/admin/settings
PUT    /api/admin/settings/contact
PUT    /api/admin/settings/social
PUT    /api/admin/settings/experience
PUT    /api/admin/settings/payment-methods
GET    /api/admin/settings/languages
POST   /api/admin/settings/languages/:code
```

#### Admin Notifications Endpoints
```
GET    /api/admin/notifications
GET    /api/admin/notifications/unread-count
PUT    /api/admin/notifications/:id/read
DELETE /api/admin/notifications/:id
```

#### Admin Data Export Endpoints
```
POST   /api/admin/export/customer-history
POST   /api/admin/export/orders
POST   /api/admin/export/payments
POST   /api/admin/export/downloads
POST   /api/admin/export/quotes
POST   /api/admin/export/custom-requests
```

### GraphQL Alternative Schema (Optional)

```graphql
type Query {
  design(id: ID!): Design
  designs(limit: Int, offset: Int, category: String): [Design!]!
  searchDesigns(query: String!): [Design!]!
  order(id: ID!): Order
  myOrders: [Order!]!
  cart: Cart!
  currentUser: User
}

type Mutation {
  createOrder(items: [CartItem!]!): Order!
  addToCart(designId: ID!, size: String!): Cart!
  submitQuote(input: QuoteInput!): Quote!
  submitCustomRequest(input: CustomRequestInput!): CustomRequest!
  uploadDesign(file: Upload!): Design! (Admin only)
}

type Subscription {
  orderStatusChanged(orderId: ID!): Order!
  customRequestUpdated(requestId: ID!): CustomRequest!
}
```

---

## Authentication & Security

### Authentication Flow

```
1. User Registration
   └─> Email verification (Gmail/email required)
   └─> Password hashing (bcrypt, 12 rounds)
   └─> Session creation

2. User Login
   └─> Credentials validation
   └─> Device fingerprinting
   └─> New device? → Send verification code
   └─> Issue JWT token + refresh token
   └─> Store session in Redis

3. Multi-Device Verification (New Device)
   └─> Send 4-digit verification code via email
   └─> User enters code
   └─> Verify and create trusted session
   └─> Notify existing sessions
   └─> Rate limiting: 3 attempts per 15 minutes

4. 2FA (Two-Factor Authentication - Optional for Admin)
   └─> Enable TOTP (Time-based OTP)
   └─> Backup codes
   └─> Verify on login

5. Forgot Password
   └─> User enters registered email
   └─> Send 4-digit code (10 min expiry)
   └─> User verifies code
   └─> User sets new password
   └─> Invalidate all sessions
```

### JWT Token Structure

```
Access Token (15 min expiry):
{
  sub: "user_id",
  email: "user@example.com",
  role: "customer|admin|freelancer",
  device_id: "unique_device_hash",
  permissions: ["read:designs", "write:orders"],
  iat: 1234567890,
  exp: 1234567900
}

Refresh Token (7 day expiry):
{
  sub: "user_id",
  session_id: "session_uuid",
  iat: 1234567890,
  exp: 1234567900
}
```

### Security Measures

- **HTTPS/SSL** - All communications encrypted
- **CSRF Protection** - Token validation on state-changing requests
- **SQL Injection Prevention** - Parameterized queries via ORM
- **XSS Prevention** - Input sanitization, output encoding
- **Rate Limiting** - 100 req/min per IP, 1000 req/min per user
- **Password Hashing** - bcrypt with 12 rounds
- **Session Timeout** - 30 days inactive = auto-logout
- **Admin Authentication** - IP whitelist, 2FA mandatory
- **File Validation** - MIME type, size limits, malware scanning
- **Private Files** - Server-side authorization checks before download
- **Audit Logging** - All admin actions logged
- **CORS** - Restricted to known domains
- **Secrets Management** - Environment variables, AWS Secrets Manager

### Role-Based Access Control (RBAC)

```
Roles:
├── Customer
│   ├── View public designs
│   ├── Create orders
│   ├── Submit quotes
│   ├── Download authorized files
│   └── Manage own account
├── Admin
│   ├── Full system access
│   ├── Manage designs, categories, bundles
│   ├── Manage orders, payments, quotes
│   ├── View all notifications
│   ├── Manage FAQ, blog, testimonials
│   ├── Manage languages, settings
│   └── View analytics & exports
├── Freelancer (Optional)
│   ├── Create custom requests
│   ├── Upload design work
│   └── Track payments
└── Moderator (Optional)
    ├── Approve/reject user content
    ├── Handle support tickets
    └── Basic analytics access
```

---

## File Management

### File Organization

```
Storage Bucket: /czdigitizing-storage/

├── /public/
│   ├── /designs/
│   │   ├── {design_id}/
│   │   │   ├── preview.jpg (1200x1200px, optimized)
│   │   │   ├── preview.webp (WEBP variant)
│   │   │   ├── thumbnail.jpg (300x300px)
│   │   │   └── gallery/
│   │   │       ├── image1.jpg
│   │   │       └── image2.jpg
│   │   └── ...
│   ├── /bundles/
│   │   └── {bundle_id}/
│   │       ├── preview.jpg
│   │       └── preview.webp
│   ├── /testimonials/
│   │   └── {testimonial_id}/
│   │       └── photo.jpg
│   ├── /header-media/
│   │   └── {ad_id}/
│   │       ├── image.jpg
│   │       └── video.mp4
│   └── /ads/
│       └── {ad_id}/
│           └── banner.jpg
│
├── /private/
│   ├── /embroidery-files/
│   │   ├── {order_id}/
│   │   │   ├── {design_id}.dst
│   │   │   ├── {design_id}.pes
│   │   │   ├── {design_id}.jef
│   │   │   ├── {design_id}.exp
│   │   │   ├── {design_id}.vp3
│   │   │   └── files.zip
│   │   └── ...
│   ├── /uploads/
│   │   └── {custom_request_id}/
│   │       ├── reference_image_1.jpg
│   │       └── reference_image_2.jpg
│   └── /temp/
│       └── {session_id}/
│           └── upload_temp.bin
│
└── /archive/
    └── {year}/{month}/
        ├── orders_backup.sql.gz
        └── files_backup.tar.gz
```

### File Upload & Download Flow

#### Design Preview Upload (Admin)
```
1. Admin selects image file
2. Validation:
   - File type: JPG, PNG, WebP
   - Max size: 10MB
   - Dimensions: 1200x1200px (resize if needed)
3. Process:
   - Compress & optimize
   - Generate WebP variant
   - Generate thumbnail (300x300)
   - Upload to /public/designs/{id}/
4. Store URLs in DB
5. Serve via CDN
```

#### Embroidery Files Upload (Admin)
```
1. Admin selects files (DST, PES, JEF, EXP, VP3)
2. Validation:
   - File types allowed: DST, PES, JEF, EXP, VP3
   - File types BLOCKED: EMB (always private)
   - Max size per file: 50MB
   - Max total: 250MB per design
3. Hash file for deduplication
4. Store in /private/embroidery-files/{design_id}/
5. Record in design_files table
6. Mark as private (is_private=true)
7. No direct URLs exposed
```

#### Customer File Download (After Payment)
```
1. Customer clicks "Download"
2. Backend checks:
   - User authentication
   - Order payment status
   - File authorization
   - Download attempt limit (optional)
3. Generate temporary signed URL (10 min expiry)
4. Log download in customer_authorized_files
5. Stream file content
6. Clean up temp file
7. DO NOT expose actual storage path
```

#### ZIP Download with File Format Protection
```
1. Admin creates order-specific ZIP:
   - Include authorized formats only
   - EXCLUDE .EMB files (even if in storage)
   - Preserve file names
   - Apply optional password
2. Store temp ZIP in /tmp/
3. Generate signed download URL
4. Customer downloads
5. Delete temp ZIP after 1 hour
```

### File Size & Performance Optimization

```
Image Optimization:
├── Preview: 1200x1200px, 80% quality, WebP + JPG
├── Thumbnail: 300x300px, WebP
├── Gallery: 800x800px, WebP
└── Lazy-load all images

Video Optimization:
├── Maximum bitrate: 5 Mbps
├── Format: MP4 (H.264)
├── Resolution: Max 1080p
├── Auto-play: Muted loop on preview
└── CDN delivery with HLS streaming

Embroidery Files:
├── No compression (binary formats)
├── Average size per file: 50-500KB
├── Stream on demand, no caching
└── Signed URL with 10 min expiry

Lazy Loading:
├── Images: Intersection Observer API
├── Videos: Play on demand
├── Pagination: Load 12 items per page
└── Virtual scrolling for large lists
```

---

## Payment Processing

### Payment Providers

#### PayPal Integration
```
Flow:
1. Customer clicks "PayPal Checkout"
2. Create PayPal order on backend
3. Redirect to PayPal
4. Customer approves & authorizes
5. PayPal redirects back with auth code
6. Backend captures payment
7. Verify transaction signature
8. Update order status → payment_confirmed
9. Release files for download
10. Send customer notification

Webhook:
- payment.capture.completed
- payment.capture.denied
- payment.capture.refunded
```

#### Bank Transfer (Manual)
```
Flow:
1. Customer selects "Bank Transfer"
2. Display bank details & unique reference number
3. Customer transfers funds (INTERAC/Wire)
4. Customer uploads receipt/proof
5. Admin notification sent
6. Admin verifies receipt
7. Admin marks payment as confirmed
8. System releases files
9. Send customer notification

Fields:
- Bank Name
- Account Holder
- Account Number / IBAN
- Swift/Routing Code
- Unique Reference (Auto-generated per order)
```

#### Future: Credit Card (Stripe)
```
- PCI-compliant token handling
- 3D Secure authentication
- Recurring billing for subscriptions
- Automatic retry logic
- Webhook handling
```

### Order Payment State Machine

```
pending
    ↓
payment_pending (awaiting customer payment)
    ↓
    ├─ [PayPal] → Direct verification
    ├─ [Bank] → Manual verification
    └─ [Card] → Stripe webhook
    ↓
payment_confirmed
    ↓
processing
    ↓
ready (files downloadable)
    ↓
completed
```

### Currency Handling

```
Primary Currency: PKR (Pakistani Rupees)

International Conversion:
- Store exchange rates updated hourly
- Auto-convert on checkout based on user location
- Show both PKR and local currency
- Store price in PKR (source of truth)

Supported Currencies: USD, EUR, GBP, AED, SGD, etc.
Exchange Rate API: OpenExchangeRates / Fixer.io

Example:
Design: 2000 PKR
User in US: $17 USD (approx)
Display: "2,000 PKR / $17 USD"
```

---

## Notifications System

### Notification Types & Triggers

#### Admin Notifications
```
1. New Quote Submitted
   - Trigger: Quote.create()
   - Delay: Immediate
   - Display: Dashboard badge + email

2. New Custom Request
   - Trigger: CustomRequest.create()
   - Delay: Immediate
   - Display: Dashboard + email

3. Payment Receipt Uploaded
   - Trigger: Order.uploadReceipt()
   - Delay: Immediate
   - Display: Dashboard + highlight

4. Order Status Change (by customer)
   - Trigger: Order.statusUpdate()
   - Delay: 5 min (batch)
   - Display: Daily summary email

5. Unanswered Taebo Question
   - Trigger: Taebo.markWaiting()
   - Delay: Immediate
   - Display: Dashboard + email

6. New Customer Registration
   - Trigger: User.register()
   - Delay: Hourly batch (if enabled)
   - Display: Email

7. System Errors
   - Trigger: Logger.error()
   - Delay: Immediate
   - Display: Dashboard alert

8. File Upload Failures
   - Trigger: FileUpload.fail()
   - Delay: Immediate
   - Display: Dashboard + admin email
```

#### Customer Notifications
```
1. Order Confirmation
   - Trigger: Order.created()
   - Delay: Immediate
   - Channels: Email, WhatsApp, In-app

2. Payment Received (after admin confirms)
   - Trigger: Order.payment_confirmed()
   - Delay: Immediate
   - Channels: Email, WhatsApp, In-app

3. Files Ready for Download
   - Trigger: Order.payment_confirmed()
   - Delay: Immediate
   - Channels: Email, WhatsApp, In-app

4. Quote Submitted Confirmation
   - Trigger: Quote.create()
   - Delay: Immediate
   - Channels: Email, In-app

5. Quote Response from Admin
   - Trigger: Quote.respond()
   - Delay: Immediate
   - Channels: Email, WhatsApp, In-app

6. Custom Request Status Update
   - Trigger: CustomRequest.statusUpdate()
   - Delay: Immediate
   - Channels: Email, WhatsApp, In-app

7. File Format Available
   - Trigger: FileFormatRequest.fulfilled()
   - Delay: Immediate
   - Channels: Email, WhatsApp, In-app

8. Subscription Renewal
   - Trigger: Subscription.renew()
   - Delay: 1 day before expiry
   - Channels: Email, In-app

9. Order Received (for large/custom orders)
   - Trigger: Quote.approved()
   - Delay: Immediate
   - Channels: Email, WhatsApp, In-app
```

### Notification Delivery

```
Email:
- SendGrid / AWS SES
- HTML templates with branding
- Unsubscribe links
- 99.9% delivery target
- Retry logic (exponential backoff)

WhatsApp:
- Twilio WhatsApp API
- Pre-approved message templates
- Order confirmations, payment, file ready
- Maximum 24-48 hour window from last customer msg
- Click-to-order links

In-App:
- Real-time via WebSocket / Server-Sent Events
- Persistent notification center
- Mark as read / archive
- 30-day retention
- Unread badge count

Push Notifications (Mobile App):
- Firebase Cloud Messaging (FCM)
- APNs for iOS
- Deep linking to relevant page
- Opt-in/opt-out per user
```

### Notification Architecture

```
User Action
    ↓
Event Published to Message Queue (RabbitMQ/Bull)
    ↓
Notification Worker (Node.js Worker)
    ├─ Fetch notification template
    ├─ Render with data
    ├─ Deliver to Email Queue
    ├─ Deliver to WhatsApp Queue (if enabled)
    └─ Save in-app notification
    ↓
Email Worker → SendGrid/SES
WhatsApp Worker → Twilio
Database → Notifications table
    ↓
User sees notification in:
- Email inbox
- WhatsApp chat
- App notification center
- Dashboard badge
```

---

## Deployment Architecture

### Environment Setup

```
Development:
├── Local PostgreSQL
├── Local Redis
├── MinIO (S3-compatible local storage)
├── Docker Compose for services
└── `.env.local` with dev credentials

Staging:
├── AWS RDS PostgreSQL
├── AWS ElastiCache Redis
├── AWS S3 for file storage
├── AWS CloudFront CDN
└── `.env.staging` with test secrets

Production:
├── AWS RDS PostgreSQL (Multi-AZ, automated backups)
├── AWS ElastiCache Redis (Multi-node cluster)
├── AWS S3 (Versioning, lifecycle policies)
├── AWS CloudFront (Global CDN)
├── AWS EC2 / ECS (App servers)
├── AWS Route53 (DNS)
├── AWS WAF (Web Application Firewall)
└── `.env.production` (Encrypted secrets)
```

### Docker Compose Setup (Development)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: czdigitizing
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    command: server /data --console-address ":9001"

  app:
    build: .
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://dev:dev@postgres:5432/czdigitizing
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
      - minio

  web:
    build: ./web
    environment:
      API_URL: http://app:3001
    ports:
      - "3000:3000"
    depends_on:
      - app

volumes:
  postgres_data:
```

### Kubernetes Deployment (Production)

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: czdigitizing

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: czdigitizing
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
      - name: api
        image: czdigitizing/api:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          value: redis://redis-cluster:6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: czdigitizing
spec:
  selector:
    app: api-server
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: czdigitizing
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
      redis:
        image: redis:7-alpine

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/czdigitizing_test
        REDIS_URL: redis://localhost:6379
    
    - name: Run linter
      run: npm run lint
    
    - name: Build
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Login to ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build, tag, and push image to ECR
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: czdigitizing-api
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    
    - name: Update Kubernetes deployment
      run: |
        kubectl set image deployment/api-server \
          api=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
          -n czdigitizing --record
    
    - name: Wait for rollout
      run: kubectl rollout status deployment/api-server -n czdigitizing
```

---

## Performance & Optimization

### Frontend Performance

```
Metrics:
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
- Time to First Byte (TTFB): < 600ms

Optimizations:
1. Code Splitting
   - Route-based: next/dynamic for pages
   - Component-based: Lazy load heavy components
   - Vendor splitting: Separate node_modules chunks

2. Image Optimization
   - Next.js <Image> component
   - Auto WebP/AVIF conversion
   - Responsive images with srcset
   - Lazy loading with placeholder
   - CDN distribution

3. Bundle Size
   - Tree-shaking: Remove unused code
   - Minification: Production builds
   - Gzip compression: 70% reduction
   - Font subsetting: Load only used characters

4. Caching Strategy
   - Browser cache: 1 year for versioned assets
   - CDN cache: 1 hour for pages
   - Service Worker: Offline fallback
   - Redis: API response caching (5 min)

5. Database Query Optimization
   - Pagination (limit 50 items)
   - Database indexes on frequently queried fields
   - Select only required columns
   - Batch queries (DataLoader)
   - Query result caching
```

### Backend Performance

```
Database:
- Connection pooling: 20-50 connections
- Read replicas: Offload read queries
- Connection timeout: 30s
- Query timeout: 10s
- Prepared statements: Prevent compilation overhead
- Index optimization: Analyzed monthly

Cache:
- Redis TTL strategy:
  - Designs: 1 hour
  - Categories: 24 hours
  - User data: 30 minutes
  - FAQs: 24 hours
  - Search results: 5 minutes
  
Load Balancing:
- Round-robin: Distribute across 3-10 app servers
- Sticky sessions: Keep user on same server
- Health checks: Every 10 seconds
- Failover: Automatic reroute

Rate Limiting:
- Anonymous: 100 req/min per IP
- Authenticated: 1000 req/min per user
- Admin API: 5000 req/min
- File uploads: 10 per hour per user

Async Processing:
- Queue system for heavy tasks:
  - Email sending
  - File processing
  - Image optimization
  - Report generation
- Worker processes: 5-10 workers per task

Monitoring:
- Response time: Track p50, p95, p99
- Error rate: Alert if > 1%
- CPU/Memory: Keep below 80%
- Database connections: Alert if > 80%
- Redis memory: Alert if > 80%
- Disk space: Alert if < 20% free
```

### Mobile App Performance

```
App Size:
- Target: < 50MB (Android), < 50MB (iOS)
- Asset optimization: Compress images, remove duplicates
- Dynamic feature modules: Download on-demand

Memory Management:
- Lazy load images & videos
- Pagination: Load 20 items per screen
- Cleanup: Unsubscribe from listeners
- Avoid memory leaks: Proper cleanup in useEffect

Network:
- Retry logic: Exponential backoff (3 attempts)
- Offline support: Cache critical screens
- Image compression: Serve optimized sizes
- API response caching: 5-60 minutes

Battery:
- Reduce location polling: Only when needed
- Background sync: Batch notifications
- Efficient animations: Use native driver
```

### Search Optimization

```
Full-Text Search Setup:
- PostgreSQL FTS for fast indexing
- Elasticsearch for complex queries (optional)
- Search index: Design name, description, tags

Query Example:
SELECT * FROM designs
WHERE to_tsvector('english', name || ' ' || description || ' ' || tags)
@@ plainto_tsquery('english', $1)
AND is_published = true
LIMIT 50;

Faceted Search:
- Category filter
- Price range filter
- Service type filter
- Popular tags
- Stitch count range
- Thread color filter
```

---

## Appendix: Implementation Roadmap

### Phase 1: MVP (Weeks 1-8)
- User authentication (email, password reset, 2FA)
- Design management (CRUD, categories)
- Design cards & browsing
- Shopping cart
- Order creation & PayPal integration
- Admin panel basics
- Email notifications

### Phase 2: Services & Quotes (Weeks 9-12)
- Service pages (Embroidery Digitizing, Vector Art)
- Smart Get a Quote system
- Quote management (Admin)
- Custom design requests
- File format requests
- FAQ & Tips sections

### Phase 3: Subscriptions & Credits (Weeks 13-16)
- Subscription plans
- Credit packages
- Subscription management
- Credit transaction tracking
- Recurring billing (PayPal)

### Phase 4: Advanced Features (Weeks 17-20)
- Taebo chatbot
- Testimonials & reviews
- Blog system
- Multi-language support (i18n)
- Advanced analytics
- Mobile app launch (iOS/Android)

### Phase 5: Polish & Launch (Weeks 21-24)
- Performance optimization
- Security hardening
- UAT & bug fixes
- Load testing
- Production deployment
- Post-launch monitoring

---

## References & Standards

- **HTTP Status Codes**: RFC 7231
- **REST API Design**: OpenAPI 3.0 Specification
- **Database Normalization**: 3rd Normal Form (3NF)
- **Security**: OWASP Top 10
- **Performance**: Google Core Web Vitals
- **Accessibility**: WCAG 2.1 Level AA

---

**Document Version**: 1.0  
**Last Updated**: August 2026  
**Author**: CZ Digitizing Development Team  
**Contact**: czdigitizing@gmail.com
