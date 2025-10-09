const { emailService } = require('../src/lib/email');

async function testBulkEmail() {
  console.log('🧪 Testing Bulk Email Functionality...\n');

  try {
    // Initialize email service
    await emailService.initialize();
    console.log('✅ Email service initialized successfully\n');

    // Test data
    const testEmails = [
      'rashidabbasi17@gmail.com',
      'test2@example.com', 
      'test3@example.com',
      'test4@example.com',
      'test5@example.com',
      'test6@example.com',
      'test7@example.com',
      'test8@example.com',
      'test9@example.com',
      'test10@example.com',
      'test11@example.com',
      'test12@example.com'
    ];

    console.log(`📧 Testing with ${testEmails.length} recipients (should trigger batch processing)...\n`);

    // Test bulk email sending
    const result = await emailService.sendEmail(
      testEmails,
      'Test Bulk Email - Batch Processing',
      '<h1>Test Email</h1><p>This is a test of the bulk email batch processing system.</p>',
      {},
      'test-user-id'
    );

    if (result) {
      console.log('✅ Bulk email test completed successfully!');
      console.log('📊 Check the console logs above for batch processing details');
    } else {
      console.log('❌ Bulk email test failed');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 This is expected if email service is not properly configured');
    console.log('   The batch processing logic should still be visible in the logs above');
  }
}

// Run the test
testBulkEmail();