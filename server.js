const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory storage for demo
const checkoutSessions = new Map();
const orders = new Map();
const paymentTokens = new Map();

// Helper functions
const validateAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      type: 'invalid_request',
      code: 'missing_authorization',
      message: 'Authorization header required'
    });
  }
  next();
};

const validateApiVersion = (req, res, next) => {
  const version = req.headers['api-version'];
  if (!version || version !== '2025-09-29') {
    return res.status(400).json({
      type: 'invalid_request',
      code: 'invalid_api_version',
      message: 'API-Version header must be 2025-09-29'
    });
  }
  next();
};

// Create mock line items
const createLineItems = (items) => {
  return items.map(item => ({
    id: `line_item_${uuidv4().slice(0, 8)}`,
    item: item,
    base_amount: Math.floor(Math.random() * 5000) + 1000, // $10-60
    discount: 0,
    subtotal: 0,
    tax: 0,
    total: 0
  }));
};

// Create fulfillment options
const createFulfillmentOptions = (address) => {
  return [
    {
      type: 'shipping',
      id: `fulfillment_option_${uuidv4().slice(0, 8)}`,
      title: 'Standard',
      subtitle: 'Arrives in 4-5 days',
      carrier: 'USPS',
      earliest_delivery_time: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      latest_delivery_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      subtotal: 100,
      tax: 0,
      total: 100
    },
    {
      type: 'shipping',
      id: `fulfillment_option_${uuidv4().slice(0, 8)}`,
      title: 'Express',
      subtitle: 'Arrives in 1-2 days',
      carrier: 'USPS',
      earliest_delivery_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      latest_delivery_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      subtotal: 500,
      tax: 0,
      total: 500
    }
  ];
};

// Calculate totals
const calculateTotals = (lineItems, fulfillmentOption) => {
  const itemsBaseAmount = lineItems.reduce((sum, item) => sum + item.base_amount, 0);
  const subtotal = itemsBaseAmount;
  const tax = Math.floor(subtotal * 0.1); // 10% tax
  const fulfillment = fulfillmentOption ? fulfillmentOption.total : 0;
  const total = subtotal + tax + fulfillment;

  return [
    {
      type: 'items_base_amount',
      display_text: 'Item(s) total',
      amount: itemsBaseAmount
    },
    {
      type: 'subtotal',
      display_text: 'Subtotal',
      amount: subtotal
    },
    {
      type: 'tax',
      display_text: 'Tax',
      amount: tax
    },
    {
      type: 'fulfillment',
      display_text: 'Fulfillment',
      amount: fulfillment
    },
    {
      type: 'total',
      display_text: 'Total',
      amount: total
    }
  ];
};

// Middleware for all ACP endpoints
app.use('/checkout_sessions', validateAuth, validateApiVersion);
app.use('/checkout_sessions/:id', validateAuth, validateApiVersion);
app.use('/agentic_commerce/delegate_payment', validateAuth, validateApiVersion);

// ===== CHECKOUT SESSION ENDPOINTS =====

// POST /checkout_sessions - Create session
app.post('/checkout_sessions', (req, res) => {
  try {
    const { items, buyer, fulfillment_address } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'invalid',
        message: 'Items array is required and must not be empty',
        param: '$.items'
      });
    }

    const sessionId = `checkout_session_${uuidv4().slice(0, 12)}`;
    const lineItems = createLineItems(items);

    // Calculate totals for each line item
    lineItems.forEach(item => {
      item.subtotal = item.base_amount;
      item.tax = Math.floor(item.subtotal * 0.1);
      item.total = item.subtotal + item.tax;
    });

    const fulfillmentOptions = createFulfillmentOptions(fulfillment_address);
    const selectedOption = fulfillmentOptions[0]; // Default to standard
    const totals = calculateTotals(lineItems, selectedOption);

    const session = {
      id: sessionId,
      payment_provider: {
        provider: 'stripe',
        supported_payment_methods: ['card']
      },
      status: 'ready_for_payment',
      currency: 'usd',
      line_items: lineItems,
      fulfillment_address: fulfillment_address || null,
      fulfillment_option_id: selectedOption.id,
      totals: totals,
      fulfillment_options: fulfillmentOptions,
      messages: [],
      links: [
        {
          type: 'terms_of_use',
          url: 'https://www.testshop.com/legal/terms-of-use'
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    checkoutSessions.set(sessionId, session);

    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: 'Internal server error'
    });
  }
});

// POST /checkout_sessions/:id - Update session
app.post('/checkout_sessions/:id', (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = checkoutSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: 'Checkout session not found',
        param: '$.id'
      });
    }

    if (session.status === 'completed' || session.status === 'canceled') {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'invalid_status',
        message: `Cannot update session with status: ${session.status}`,
        param: '$.status'
      });
    }

    const { items, fulfillment_address, fulfillment_option_id } = req.body;

    // Update session based on provided fields
    if (items) {
      const lineItems = createLineItems(items);
      lineItems.forEach(item => {
        item.subtotal = item.base_amount;
        item.tax = Math.floor(item.subtotal * 0.1);
        item.total = item.subtotal + item.tax;
      });
      session.line_items = lineItems;
    }

    if (fulfillment_address) {
      session.fulfillment_address = fulfillment_address;
    }

    if (fulfillment_option_id) {
      const option = session.fulfillment_options.find(opt => opt.id === fulfillment_option_id);
      if (!option) {
        return res.status(400).json({
          type: 'invalid_request',
          code: 'invalid',
          message: 'Invalid fulfillment option ID',
          param: '$.fulfillment_option_id'
        });
      }
      session.fulfillment_option_id = fulfillment_option_id;
    }

    // Recalculate totals
    const selectedOption = session.fulfillment_options.find(opt => opt.id === session.fulfillment_option_id);
    session.totals = calculateTotals(session.line_items, selectedOption);
    session.updated_at = new Date().toISOString();

    checkoutSessions.set(sessionId, session);
    res.json(session);
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: 'Internal server error'
    });
  }
});

// GET /checkout_sessions/:id - Retrieve session
app.get('/checkout_sessions/:id', (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = checkoutSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: 'Checkout session not found',
        param: '$.id'
      });
    }

    res.json(session);
  } catch (error) {
    console.error('Retrieve session error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: 'Internal server error'
    });
  }
});

// POST /checkout_sessions/:id/complete - Complete session
app.post('/checkout_sessions/:id/complete', (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = checkoutSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: 'Checkout session not found',
        param: '$.id'
      });
    }

    if (session.status !== 'ready_for_payment') {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'invalid_status',
        message: `Cannot complete session with status: ${session.status}`,
        param: '$.status'
      });
    }

    const { buyer, payment_data } = req.body;

    if (!payment_data || !payment_data.token) {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'invalid',
        message: 'Payment data with token is required',
        param: '$.payment_data'
      });
    }

    // Create order
    const orderId = `ord_${uuidv4().slice(0, 12)}`;
    const order = {
      id: orderId,
      checkout_session_id: sessionId,
      permalink_url: `https://www.testshop.com/orders/${orderId}`,
      status: 'created',
      created_at: new Date().toISOString()
    };

    orders.set(orderId, order);

    // Update session
    session.status = 'completed';
    session.buyer = buyer;
    session.order = order;
    session.updated_at = new Date().toISOString();

    checkoutSessions.set(sessionId, session);

    res.json(session);
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: 'Internal server error'
    });
  }
});

// POST /checkout_sessions/:id/cancel - Cancel session
app.post('/checkout_sessions/:id/cancel', (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = checkoutSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: 'Checkout session not found',
        param: '$.id'
      });
    }

    if (session.status === 'completed' || session.status === 'canceled') {
      return res.status(405).json({
        type: 'invalid_request',
        code: 'invalid_status',
        message: `Cannot cancel session with status: ${session.status}`,
        param: '$.status'
      });
    }

    session.status = 'canceled';
    session.messages = [
      {
        type: 'info',
        content_type: 'plain',
        content: 'Checkout session has been canceled.'
      }
    ];
    session.updated_at = new Date().toISOString();

    checkoutSessions.set(sessionId, session);
    res.json(session);
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: 'Internal server error'
    });
  }
});

// ===== DELEGATE PAYMENT ENDPOINT =====

// POST /agentic_commerce/delegate_payment - Create payment token
app.post('/agentic_commerce/delegate_payment', (req, res) => {
  try {
    const { payment_method, allowance, billing_address, risk_signals, metadata } = req.body;

    // Validate required fields
    if (!payment_method || payment_method.type !== 'card') {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'invalid_card',
        message: 'Payment method type must be card',
        param: '$.payment_method.type'
      });
    }

    if (!allowance || allowance.reason !== 'one_time') {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'invalid_allowance',
        message: 'Allowance reason must be one_time',
        param: '$.allowance.reason'
      });
    }

    if (!risk_signals || !Array.isArray(risk_signals) || risk_signals.length === 0) {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'invalid',
        message: 'At least one risk signal is required',
        param: '$.risk_signals'
      });
    }

    // Create payment token
    const tokenId = `vt_${uuidv4().slice(0, 12)}`;
    const token = {
      id: tokenId,
      created: new Date().toISOString(),
      payment_method: payment_method,
      allowance: allowance,
      billing_address: billing_address,
      risk_signals: risk_signals,
      metadata: metadata || {}
    };

    paymentTokens.set(tokenId, token);

    res.status(201).json({
      id: tokenId,
      created: token.created,
      metadata: metadata || {}
    });
  } catch (error) {
    console.error('Delegate payment error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: 'Internal server error'
    });
  }
});

// ===== WEBHOOK ENDPOINTS =====

// POST /webhooks - Webhook receiver
app.post('/webhooks', (req, res) => {
  try {
    const { type, data } = req.body;

    console.log('Webhook received:', type, data);

    // Here you would normally verify the signature
    // For demo purposes, we'll just log it

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal server error');
  }
});

// ===== INFO ENDPOINTS =====

const path = require('path');

// GET / - Serve client interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

// GET /api - Server info
app.get('/api', (req, res) => {
  res.json({
    name: 'ACP Sandbox',
    version: '1.0.0',
    description: 'Agentic Commerce Protocol Sandbox Environment',
    endpoints: {
      checkout_sessions: {
        create: 'POST /checkout_sessions',
        update: 'POST /checkout_sessions/:id',
        retrieve: 'GET /checkout_sessions/:id',
        complete: 'POST /checkout_sessions/:id/complete',
        cancel: 'POST /checkout_sessions/:id/cancel'
      },
      delegate_payment: 'POST /agentic_commerce/delegate_payment',
      webhooks: 'POST /webhooks'
    },
    docs: 'https://github.com/openai/agentic-commerce-protocol'
  });
});

// GET /health - Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    sessions: checkoutSessions.size,
    orders: orders.size,
    tokens: paymentTokens.size
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ACP Sandbox Server running on port ${PORT}`);
  console.log(`📖 Documentation: http://localhost:${PORT}/`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Required headers:`);
  console.log(`   Authorization: Bearer <token>`);
  console.log(`   API-Version: 2025-09-29`);
});

module.exports = app;