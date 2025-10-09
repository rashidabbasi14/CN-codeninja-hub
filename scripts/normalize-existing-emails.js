const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function normalizeExistingEmails() {
  console.log('🔄 Starting email normalization process...');
  
  try {
    // Get all users with non-lowercase emails
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true
      }
    });

    console.log(`📊 Found ${users.length} users to check`);

    let normalizedCount = 0;
    let duplicatesFound = [];

    for (const user of users) {
      const normalizedEmail = user.email.toLowerCase();
      
      // Only update if the email is not already lowercase
      if (user.email !== normalizedEmail) {
        console.log(`📧 Normalizing: ${user.email} -> ${normalizedEmail}`);
        
        // Check if normalized email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail }
        });

        if (existingUser && existingUser.id !== user.id) {
          console.log(`⚠️  Duplicate found: ${user.email} conflicts with existing ${normalizedEmail}`);
          duplicatesFound.push({
            originalId: user.id,
            originalEmail: user.email,
            conflictingId: existingUser.id,
            conflictingEmail: existingUser.email
          });
          continue;
        }

        // Update the email to lowercase
        await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail }
        });

        normalizedCount++;
      }
    }

    console.log(`✅ Successfully normalized ${normalizedCount} email addresses`);
    
    if (duplicatesFound.length > 0) {
      console.log(`\n⚠️  Found ${duplicatesFound.length} potential duplicates that need manual review:`);
      duplicatesFound.forEach((dup, index) => {
        console.log(`${index + 1}. User ID ${dup.originalId} (${dup.originalEmail}) conflicts with User ID ${dup.conflictingId} (${dup.conflictingEmail})`);
      });
      console.log('\n📝 Please review these duplicates manually and decide which accounts to keep.');
    }

    console.log('\n🎉 Email normalization completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during email normalization:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  normalizeExistingEmails()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { normalizeExistingEmails };