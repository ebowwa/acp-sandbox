# ACP Sandbox 🤖

A fully functional sandbox environment for testing the **Agentic Commerce Protocol (ACP)** based on the official OpenAI/Stripe specifications.

## 🎯 What This Actually Is

**Think of this as a complete fake e-commerce store** - not just a payment processor.

```
Fake Product Feed + Fake Payment System = Complete Mock Store
```

**What the Sandbox Simulates:**
- 🏪 **Mock Store**: Acts like Amazon, Target, or any online retailer
- 📦 **Fake Product Catalog**: Generates mock items with realistic pricing
- 🚚 **Mock Shipping**: Calculates delivery options and costs
- 💳 **Mock Payment Processing**: Handles fake transactions securely
- 📋 **Mock Order Management**: Creates fake order confirmations

**What It's NOT:**
- ❌ A real e-commerce platform (like Shopify)
- ❌ A shopping assistant/agent (that's what ChatGPT becomes)
- ❌ Real payment processing (no actual money involved)

**The Goal:**
Build AI agents (like ChatGPT with custom instructions) that can help users shop and buy things by practicing against this safe, mock environment before connecting to real stores.

## 🚀 Quick Start

```bash
# Start the sandbox server
npm start

# Or for development with auto-reload
npm run dev

# Run API test script
node test-api.js

# Open the test client in your browser
# http://localhost:3000/client.html
```

## 📋 What's Included

### **Mock Merchant API Server**
- ✅ All 5 checkout session endpoints
- ✅ Delegate payment token creation
- ✅ Proper error handling and validation
- ✅ In-memory data storage
- ✅ Webhook receiver
- ✅ Health check endpoint

### **Web Test Client**
- ✅ Complete checkout flow testing
- ✅ Individual endpoint testing
- ✅ Real-time step indicators
- ✅ Form-based data entry
- ✅ Response visualization
- ✅ Server health monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Web Client     │◄──►│  Mock Merchant   │◄──►│  Payment Sim    │
│  (Test UI)      │    │     API Server   │    │  (Token Gen)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Webhook Receiver│
                       │  (Event Logger)  │
                       └─────────────────┘
```

## 🔧 Available Endpoints

### Checkout Sessions
- `POST /checkout_sessions` - Create new session
- `POST /checkout_sessions/:id` - Update existing session
- `GET /checkout_sessions/:id` - Retrieve session details
- `POST /checkout_sessions/:id/complete` - Complete checkout (creates order)
- `POST /checkout_sessions/:id/cancel` - Cancel session

### Payment Delegation
- `POST /agentic_commerce/delegate_payment` - Create payment token

### Utility
- `GET /` - Server info and documentation
- `GET /health` - Server health check
- `POST /webhooks` - Webhook receiver

## 🧪 Testing Scenarios

### **Complete Flow Test**
1. Create checkout session with items and address
2. Update fulfillment option (standard → express)
3. Create payment token with card details
4. Complete checkout with payment and buyer info
5. Retrieve final session state

### **Individual Tests**
- Session creation validation
- Fulfillment option updates
- Payment token generation
- Order creation
- Error handling scenarios

## 📝 Request Headers Required

```http
Authorization: Bearer <your_auth_token>
API-Version: 2025-09-29
Content-Type: application/json
```

## 💡 Features

### **Mock Data Generation**
- Random pricing and tax calculations
- Multiple fulfillment options
- Dynamic order IDs
- Realistic timestamps

### **Security Validation**
- Authentication header validation
- API version checking
- Request parameter validation
- Proper error responses

### **Developer Experience**
- Detailed logging
- Structured error responses
- Real-time health monitoring
- Interactive web interface

## 🛠️ Configuration

The sandbox uses environment variables (create `.env` file):

```env
PORT=3000
NODE_ENV=development
```

## 🧪 Test Data Examples

### Create Checkout Session
```json
{
  "items": [{"id": "item_123", "quantity": 1}],
  "fulfillment_address": {
    "name": "John Doe",
    "line_one": "1234 Chat Road",
    "city": "San Francisco",
    "state": "CA",
    "country": "US",
    "postal_code": "94131"
  }
}
```

### Delegate Payment
```json
{
  "payment_method": {
    "type": "card",
    "number": "4242424242424242",
    "exp_month": "11",
    "exp_year": "2026",
    "cvc": "223"
  },
  "allowance": {
    "reason": "one_time",
    "max_amount": 10000,
    "currency": "usd",
    "checkout_session_id": "cs_123",
    "merchant_id": "test_merchant",
    "expires_at": "2025-10-29T12:00:00Z"
  },
  "risk_signals": [{
    "type": "card_testing",
    "score": 10,
    "action": "authorized"
  }]
}
```

## 📊 Monitoring

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T03:00:00.000Z",
  "sessions": 5,
  "orders": 3,
  "tokens": 2
}
```

## 🚨 Error Handling

All errors follow the ACP specification:

```json
{
  "type": "invalid_request",
  "code": "missing_authorization",
  "message": "Authorization header required",
  "param": "$.authorization"
}
```

## 🔄 Data Persistence

This sandbox uses **in-memory storage** for simplicity:
- All data resets on server restart
- No database required
- Perfect for testing and development

## 🤝 Contributing

This sandbox implements the official ACP specification. For production use, refer to:
- [OpenAI Commerce Documentation](https://developers.openai.com/commerce/)
- [Stripe Agentic Commerce](https://docs.stripe.com/agentic-commerce)
- [ACP Specification](https://github.com/openai/agentic-commerce-protocol)

## 📄 License

MIT License - Feel free to use this for testing and development!

---

**🚨 Important:** This is a **sandbox environment** only. Do not use with real payment data or in production.