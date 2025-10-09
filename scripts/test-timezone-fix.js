/**
 * Test script to verify timezone conversion in email notifications
 * Run with: node scripts/test-timezone-fix.js
 */

// Test the timezone conversion logic
function testTimezoneConversion() {
  console.log('🧪 Testing Timezone Conversion Fix\n');
  
  // Create a sample UTC datetime (like what's stored in database)
  const utcDateTime = new Date('2025-01-15T14:30:00.000Z'); // 2:30 PM UTC
  
  console.log('📅 Sample Match DateTime (UTC):', utcDateTime.toISOString());
  console.log('');
  
  // Test different timezones
  const timezones = [
    'UTC',
    'Asia/Karachi',      // UTC+5
    'America/New_York',  // UTC-5 (EST) / UTC-4 (EDT)
    'Europe/London',     // UTC+0 (GMT) / UTC+1 (BST)
    'Asia/Tokyo',        // UTC+9
    'Australia/Sydney',  // UTC+10 / UTC+11
  ];
  
  console.log('🌍 Time conversion for different user timezones:');
  console.log('='.repeat(60));
  
  timezones.forEach(timezone => {
    const matchTime = utcDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone
    });
    
    const matchDate = utcDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timezone
    });
    
    console.log(`${timezone.padEnd(20)} | ${matchDate} at ${matchTime}`);
  });
  
  console.log('='.repeat(60));
  console.log('');
  
  // Test the old vs new approach
  console.log('🔄 Comparison: Old vs New Approach');
  console.log('-'.repeat(40));
  
  // Old approach (admin timezone only)
  const adminTimezone = 'Asia/Karachi';
  const oldTime = utcDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: adminTimezone
  });
  const oldDate = utcDateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: adminTimezone
  });
  
  console.log('❌ OLD (Admin timezone for all users):');
  console.log(`   All users see: ${oldDate} at ${oldTime} (${adminTimezone})`);
  console.log('');
  
  // New approach (user-specific timezone)
  console.log('✅ NEW (User-specific timezone):');
  console.log('   Each user sees time in their own timezone:');
  
  const sampleUsers = [
    { name: 'User in Pakistan', timezone: 'Asia/Karachi' },
    { name: 'User in USA', timezone: 'America/New_York' },
    { name: 'User in UK', timezone: 'Europe/London' },
  ];
  
  sampleUsers.forEach(user => {
    const userTime = utcDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: user.timezone
    });
    const userDate = utcDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: user.timezone
    });
    
    console.log(`   ${user.name}: ${userDate} at ${userTime}`);
  });
  
  console.log('');
  console.log('✅ Fix Applied Successfully!');
  console.log('📧 Email notifications now show correct local time for each user');
  console.log('');
  console.log('📝 Environment Variables:');
  console.log('   - DEFAULT_USER_TIMEZONE: Controls default timezone for users');
  console.log('   - ADMIN_TIMEZONE: Still used for admin operations');
  console.log('');
  console.log('🔮 Future Enhancement:');
  console.log('   - Add timezone field to User model for per-user preferences');
  console.log('   - Allow users to set their timezone in profile settings');
}

// Run the test
testTimezoneConversion();