const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyEmails(emails) {
  try {
    console.log('🔍 Verifying emails in database...\n');
    
    const results = {
      found: [],
      notFound: [],
      total: emails.length
    };

    for (const email of emails) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isBlocked: true,
            isEmailVerified: true,
            createdAt: true
          }
        });

        if (user) {
          results.found.push({
            email: email,
            user: user
          });
          console.log(`✅ FOUND: ${email}`);
          console.log(`   Name: ${user.firstName} ${user.lastName}`);
          console.log(`   Role: ${user.role}`);
          console.log(`   Verified: ${user.isEmailVerified ? 'Yes' : 'No'}`);
          console.log(`   Blocked: ${user.isBlocked ? 'Yes' : 'No'}`);
          console.log(`   Created: ${user.createdAt.toISOString()}`);
          console.log('');
        } else {
          results.notFound.push(email);
          console.log(`❌ NOT FOUND: ${email}`);
        }
      } catch (error) {
        console.error(`❌ ERROR checking ${email}:`, error.message);
        results.notFound.push(email);
      }
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`Total emails checked: ${results.total}`);
    console.log(`Found in database: ${results.found.length}`);
    console.log(`Not found: ${results.notFound.length}`);
    
    if (results.notFound.length > 0) {
      console.log('\n❌ Emails NOT found in database:');
      results.notFound.forEach(email => console.log(`   - ${email}`));
    }

    if (results.found.length > 0) {
      console.log('\n✅ Emails FOUND in database:');
      results.found.forEach(item => console.log(`   - ${item.email} (${item.user.firstName} ${item.user.lastName})`));
    }

    return results;

  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Example usage - replace this array with your emails
const emailsToCheck = [
  // Add your emails here, one per line
  // 'user1@example.com',
  // 'user2@example.com',
  // 'user3@example.com',
];

// If emails are provided as command line arguments
const cliEmails = process.argv.slice(2);
const emails = cliEmails.length > 0 ? cliEmails : emailsToCheck;

if (emails.length === 0) {
  console.log('❌ No emails provided!');
  console.log('\nUsage:');
  console.log('1. Edit the emailsToCheck array in this script, or');
  console.log('2. Pass emails as command line arguments:');
  console.log('   node scripts/verify-emails.js email1@example.com email2@example.com');
  process.exit(1);
}

// Run the verification
verifyEmails(emails)
  .then((results) => {
    console.log('\n✅ Email verification completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });