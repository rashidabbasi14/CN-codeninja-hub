/**
 * Test script to verify audit logging implementation for events page activities
 * This script simulates API calls to test the audit logging functionality
 */

const BASE_URL = 'http://localhost:3000';

// Mock user authentication token (you'll need to replace this with a real token)
const AUTH_TOKEN = 'your-jwt-token-here';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

async function testAuditLogging() {
  console.log('🧪 Testing Audit Logging for Events Page Activities\n');

  try {
    // Test 1: Events viewing
    console.log('1. Testing events viewing audit log...');
    const eventsResponse = await fetch(`${BASE_URL}/api/events`, {
      method: 'GET',
      headers
    });
    
    if (eventsResponse.ok) {
      console.log('✅ Events API call successful');
      console.log('   Expected audit log: events.viewed');
    } else {
      console.log('❌ Events API call failed:', eventsResponse.status);
    }

    // Test 2: Game registration
    console.log('\n2. Testing game registration audit log...');
    const registrationData = {
      registrations: [{
        gameName: 'Test Game',
        level: 'Beginner',
        mode: 'INDIVIDUAL'
      }],
      eventId: 'test-event-id'
    };

    const registerResponse = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(registrationData)
    });

    if (registerResponse.ok) {
      console.log('✅ Registration API call successful');
      console.log('   Expected audit log: game.registered');
    } else {
      console.log('❌ Registration API call failed:', registerResponse.status);
    }

    // Test 3: Schedule viewing
    console.log('\n3. Testing schedule viewing audit log...');
    const scheduleResponse = await fetch(`${BASE_URL}/api/events/test-event-id/schedule`, {
      method: 'GET',
      headers
    });

    if (scheduleResponse.ok) {
      console.log('✅ Schedule API call successful');
      console.log('   Expected audit log: schedule.viewed');
    } else {
      console.log('❌ Schedule API call failed:', scheduleResponse.status);
    }

    // Test 4: Check audit logs
    console.log('\n4. Checking audit logs...');
    const auditResponse = await fetch(`${BASE_URL}/api/admin/audit`, {
      method: 'GET',
      headers
    });

    if (auditResponse.ok) {
      const auditData = await auditResponse.json();
      console.log('✅ Audit logs retrieved successfully');
      console.log(`   Total logs: ${auditData.auditLogs?.length || 0}`);
      
      // Check for our new audit actions
      const eventActions = auditData.auditLogs?.filter(log => 
        ['events.viewed', 'game.registered', 'schedule.viewed', 'team.joined', 'game.unregistered', 'game.registration_updated', 'team.created'].includes(log.action)
      ) || [];
      
      console.log(`   Event-related audit logs: ${eventActions.length}`);
      eventActions.forEach(log => {
        console.log(`   - ${log.action}: ${log.actor?.firstName} ${log.actor?.lastName} (${new Date(log.createdAt).toLocaleString()})`);
      });
    } else {
      console.log('❌ Failed to retrieve audit logs:', auditResponse.status);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }

  console.log('\n🏁 Audit logging test completed!');
  console.log('\nTo run this test:');
  console.log('1. Start your Next.js development server: npm run dev');
  console.log('2. Replace AUTH_TOKEN with a valid JWT token');
  console.log('3. Run: node test-audit-logging.js');
  console.log('\nExpected audit log entries:');
  console.log('- events.viewed: When users view the events page');
  console.log('- game.registered: When users register for games');
  console.log('- game.unregistered: When users unregister from games');
  console.log('- game.registration_updated: When users update their registrations');
  console.log('- team.created: When users create teams');
  console.log('- team.joined: When users join existing teams');
  console.log('- schedule.viewed: When users view event schedules');
}

// Run the test if this script is executed directly
if (require.main === module) {
  testAuditLogging();
}

module.exports = { testAuditLogging };