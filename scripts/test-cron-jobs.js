#!/usr/bin/env node

/**
 * Test script for Vercel cron jobs
 * Run this to test all cron endpoints locally or on deployed app
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TIMEOUT = 30000; // 30 seconds

// Cron endpoints to test
const CRON_ENDPOINTS = [
  '/api/cron/game-reminders',
  '/api/cron/early-reminders',
  '/api/cron/cache-cleanup',
  '/api/cron/health'
];

/**
 * Make HTTP request
 */
function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const options = {
      method,
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Cron-Test-Script',
        'Content-Type': 'application/json'
      }
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Test a single cron endpoint
 */
async function testCronEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  
  console.log(`\n🧪 Testing: ${endpoint}`);
  console.log(`   URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await makeRequest(url);
    const duration = Date.now() - startTime;
    
    const status = response.status === 200 ? '✅' : '❌';
    console.log(`   ${status} Status: ${response.status}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    
    if (response.data && typeof response.data === 'object') {
      console.log(`   📊 Success: ${response.data.success}`);
      console.log(`   💬 Message: ${response.data.message}`);
      
      if (response.data.error) {
        console.log(`   ❌ Error: ${response.data.error}`);
      }
      
      if (response.data.result) {
        console.log(`   📈 Result:`, JSON.stringify(response.data.result, null, 2));
      }
    }
    
    return {
      endpoint,
      success: response.status === 200,
      status: response.status,
      duration,
      data: response.data
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      endpoint,
      success: false,
      error: error.message
    };
  }
}

/**
 * Test health endpoint with POST (manual trigger)
 */
async function testHealthTrigger() {
  const url = `${BASE_URL}/api/cron/health`;
  
  console.log(`\n🚀 Testing manual trigger: POST /api/cron/health`);
  console.log(`   URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await makeRequest(url, 'POST');
    const duration = Date.now() - startTime;
    
    const status = response.status === 200 ? '✅' : '❌';
    console.log(`   ${status} Status: ${response.status}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    
    if (response.data && typeof response.data === 'object') {
      console.log(`   📊 Success: ${response.data.success}`);
      console.log(`   💬 Message: ${response.data.message}`);
      
      if (response.data.results) {
        console.log(`   📈 Results:`);
        response.data.results.forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.jobPath}: ${result.status}`);
        });
      }
    }
    
    return {
      endpoint: '/api/cron/health (POST)',
      success: response.status === 200,
      status: response.status,
      duration,
      data: response.data
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      endpoint: '/api/cron/health (POST)',
      success: false,
      error: error.message
    };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🔧 Vercel Cron Jobs Test Suite');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT}ms`);
  
  const results = [];
  
  // Test all GET endpoints
  for (const endpoint of CRON_ENDPOINTS) {
    const result = await testCronEndpoint(endpoint);
    results.push(result);
  }
  
  // Test manual trigger
  const triggerResult = await testHealthTrigger();
  results.push(triggerResult);
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Successful: ${successful}/${total}`);
  console.log(`❌ Failed: ${total - successful}/${total}`);
  
  if (successful === total) {
    console.log('\n🎉 All tests passed! Cron jobs are working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testCronEndpoint };