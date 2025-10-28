#!/usr/bin/env node

// ACP Sandbox API Test Script
// Demonstrates programmatic usage of the ACP sandbox

const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'test_token_12345';
const API_VERSION = '2025-09-29';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'API-Version': API_VERSION,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test data
const testItems = [{ id: 'item_123', quantity: 1 }];
const testAddress = {
  name: 'Jane Smith',
  line_one: '456 AI Boulevard',
  city: 'San Francisco',
  state: 'CA',
  country: 'US',
  postal_code: '94102'
};
const testPaymentMethod = {
  type: 'card',
  card_number_type: 'fpan',
  virtual: false,
  number: '4242424242424242',
  exp_month: '12',
  exp_year: '2025',
  name: 'Jane Smith',
  cvc: '123',
  checks_performed: ['avs', 'cvv'],
  iin: '424242',
  display_card_funding_type: 'credit',
  display_brand: 'visa',
  display_last4: '4242',
  metadata: {}
};

// Main test function
async function runAcpTest() {
  console.log('🚀 Starting ACP Sandbox API Test\n');

  try {
    // Step 1: Check server health
    console.log('📊 Step 1: Checking server health...');
    const health = await makeRequest('GET', '/health');
    console.log(`Status: ${health.status}`);
    console.log(`Response: ${JSON.stringify(health.data, null, 2)}\n`);

    // Step 2: Create checkout session
    console.log('🛒 Step 2: Creating checkout session...');
    const createResponse = await makeRequest('POST', '/checkout_sessions', {
      items: testItems,
      fulfillment_address: testAddress
    });
    console.log(`Status: ${createResponse.status}`);
    console.log(`Session ID: ${createResponse.data.id}`);
    console.log(`Status: ${createResponse.data.status}\n`);

    const sessionId = createResponse.data.id;

    // Step 3: Update session with different fulfillment option
    console.log('📦 Step 3: Updating fulfillment option...');
    const updateResponse = await makeRequest('POST', `/checkout_sessions/${sessionId}`, {
      fulfillment_option_id: createResponse.data.fulfillment_options[1].id
    });
    console.log(`Status: ${updateResponse.status}`);
    console.log(`Updated total: $${(updateResponse.data.totals.find(t => t.type === 'total').amount / 100).toFixed(2)}\n`);

    // Step 4: Create payment token
    console.log('💳 Step 4: Creating payment token...');
    const tokenResponse = await makeRequest('POST', '/agentic_commerce/delegate_payment', {
      payment_method: testPaymentMethod,
      allowance: {
        reason: 'one_time',
        max_amount: 10000,
        currency: 'usd',
        checkout_session_id: sessionId,
        merchant_id: 'test_merchant',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      },
      billing_address: testAddress,
      risk_signals: [{
        type: 'card_testing',
        score: 10,
        action: 'authorized'
      }],
      metadata: {
        source: 'api_test',
        test_mode: true
      }
    });
    console.log(`Status: ${tokenResponse.status}`);
    console.log(`Token ID: ${tokenResponse.data.id}\n`);

    const tokenId = tokenResponse.data.id;

    // Step 5: Complete checkout
    console.log('✅ Step 5: Completing checkout...');
    const completeResponse = await makeRequest('POST', `/checkout_sessions/${sessionId}/complete`, {
      buyer: {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com'
      },
      payment_data: {
        token: tokenId,
        provider: 'stripe',
        billing_address: testAddress
      }
    });
    console.log(`Status: ${completeResponse.status}`);
    console.log(`Final status: ${completeResponse.data.status}`);
    console.log(`Order ID: ${completeResponse.data.order.id}\n`);

    // Step 6: Retrieve final session
    console.log('📋 Step 6: Retrieving final session...');
    const retrieveResponse = await makeRequest('GET', `/checkout_sessions/${sessionId}`);
    console.log(`Status: ${retrieveResponse.status}`);
    console.log(`Session status: ${retrieveResponse.data.status}`);
    console.log(`Order created: ${retrieveResponse.data.order ? 'Yes' : 'No'}\n`);

    console.log('🎉 ACP Test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Session ID: ${sessionId}`);
    console.log(`- Token ID: ${tokenId}`);
    console.log(`- Order ID: ${completeResponse.data.order.id}`);
    console.log(`- Total amount: $${(retrieveResponse.data.totals.find(t => t.type === 'total').amount / 100).toFixed(2)}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runAcpTest();
}

module.exports = { makeRequest, runAcpTest };