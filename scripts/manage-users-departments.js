const { PrismaClient } = require('@prisma/client');
const { USER_DATA } = require('./user-data.js');

const prisma = new PrismaClient();


/**
 * Get or create a department by name
 * @param {string} departmentName - Name of the department
 * @param {string} createdBy - ID of the user creating the department
 * @returns {Promise<Object>} Department object
 */
async function getOrCreateDepartment(departmentName, createdBy) {
  if (!departmentName) {
    return null;
  }

  try {
    // Try to find existing department (case-insensitive)
    let department = await prisma.department.findFirst({
      where: {
        name: {
          equals: departmentName,
          mode: 'insensitive'
        }
      }
    });

    // If department doesn't exist, create it
    if (!department) {
      department = await prisma.department.create({
        data: {
          name: departmentName,
          createdBy: createdBy
        }
      });
      console.log(`✅ Created new department: ${departmentName}`);
    }

    return department;
  } catch (error) {
    console.error(`❌ Error handling department ${departmentName}:`, error.message);
    return null;
  }
}

/**
 * Update existing user or create new user
 * @param {Object} userData - User data object
 * @param {string} adminUserId - ID of admin user for department creation
 * @returns {Promise<Object>} User object
 */
async function upsertUser(userData, adminUserId) {
  const { email, firstName, lastName, jobTitle, departmentName, gender } = userData;
  
  try {
    // Get or create department if specified
    let department = null;
    if (departmentName) {
      department = await getOrCreateDepartment(departmentName, adminUserId);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        department: true
      }
    });

    if (existingUser) {
      // Update existing user
      const updatedUser = await prisma.user.update({
        where: { email: email.toLowerCase().trim() },
        data: {
          firstName: firstName || existingUser.firstName,
          lastName: lastName || existingUser.lastName,
          jobTitle: jobTitle || existingUser.jobTitle,
          gender: gender || existingUser.gender,
          departmentId: department ? department.id : existingUser.departmentId,
        },
        include: {
          department: true
        }
      });
      
      console.log(`🔄 Updated user: ${email} - ${firstName} ${lastName} (${gender || 'No gender'}) (${jobTitle || 'No title'}) - Dept: ${department?.name || 'No department'}`);
      return updatedUser;
    } else {
      // Create new user
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          firstName: firstName || 'Unknown',
          lastName: lastName || 'User',
          jobTitle: jobTitle,
          gender: gender || 'MALE',
          age: 25,
          departmentId: department ? department.id : null,
          role: 'USER',
          isEmailVerified: false,
        },
        include: {
          department: true
        }
      });
      
      console.log(`✅ Created new user: ${email} - ${firstName} ${lastName} (${gender || 'MALE'}) (${jobTitle || 'No title'}) - Dept: ${department?.name || 'No department'}`);
      return newUser;
    }
  } catch (error) {
    console.error(`❌ Error processing user ${email}:`, error.message);
    return null;
  }
}

/**
 * Get all users and departments from database
 * @returns {Promise<Object>} Object containing users and departments
 */
async function getAllUsersAndDepartments() {
  try {
    const users = await prisma.user.findMany({
      include: {
        department: true
      },
      orderBy: {
        email: 'asc'
      }
    });

    const departments = await prisma.department.findMany({
      include: {
        users: true,
        creator: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return { users, departments };
  } catch (error) {
    console.error('❌ Error fetching users and departments:', error.message);
    return { users: [], departments: [] };
  }
}

/**
 * Display summary of users and departments
 * @param {Array} users - Array of user objects
 * @param {Array} departments - Array of department objects
 */
function displaySummary(users, departments) {
  console.log('\n📊 DATABASE SUMMARY');
  console.log('='.repeat(50));
  
  console.log(`\n👥 USERS (${users.length} total):`);
  users.forEach((user, index) => {
    const deptInfo = user.department ? ` - ${user.department.name}` : ' - No Department';
    const jobInfo = user.jobTitle ? ` (${user.jobTitle})` : '';
    const genderInfo = user.gender ? ` [${user.gender}]` : '';
    console.log(`${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}${genderInfo}${jobInfo}${deptInfo}`);
  });

  console.log(`\n🏢 DEPARTMENTS (${departments.length} total):`);
  departments.forEach((dept, index) => {
    const userCount = dept.users ? dept.users.length : 0;
    const creatorInfo = dept.creator ? ` - Created by: ${dept.creator.firstName} ${dept.creator.lastName}` : '';
    console.log(`${index + 1}. ${dept.name} (${userCount} users)${creatorInfo}`);
  });

  // Gender distribution summary
  const genderStats = users.reduce((acc, user) => {
    const gender = user.gender || 'MALE';
    acc[gender] = (acc[gender] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n👫 GENDER DISTRIBUTION:`);
  Object.entries(genderStats).forEach(([gender, count]) => {
    const percentage = ((count / users.length) * 100).toFixed(1);
    console.log(`   • ${gender}: ${count} (${percentage}%)`);
  });

  // Department distribution summary
  const deptStats = users.reduce((acc, user) => {
    const dept = user.department?.name || 'No Department';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n🏢 DEPARTMENT DISTRIBUTION:`);
  Object.entries(deptStats).forEach(([dept, count]) => {
    const percentage = ((count / users.length) * 100).toFixed(1);
    console.log(`   • ${dept}: ${count} (${percentage}%)`);
  });
}

/**
 * Main function to manage users and departments
 */
async function manageUsersAndDepartments() {
  console.log('🚀 Starting User and Department Management Script');
  console.log('='.repeat(60));

  try {
    // First, get current state of database
    console.log('\n📋 Getting current database state...');
    const { users: currentUsers, departments: currentDepartments } = await getAllUsersAndDepartments();
    
    console.log(`\n📊 Current state: ${currentUsers.length} users, ${currentDepartments.length} departments`);

    // Find an admin user to use for department creation, or use the first user
    let adminUser = currentUsers.find(user => user.role === 'ADMIN');
    if (!adminUser && currentUsers.length > 0) {
      adminUser = currentUsers[0];
      console.log(`⚠️  No admin user found, using ${adminUser.email} for department creation`);
    } else if (!adminUser) {
      console.log('❌ No users found in database. Please create at least one user first.');
      return;
    }

    console.log(`\n🔧 Processing ${USER_DATA.length} user records...`);
    
    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;

    // Process each user in the data
    for (const userData of USER_DATA) {
      if (!userData.email) {
        console.log('⚠️  Skipping user with no email address');
        errorCount++;
        continue;
      }

      const existingUser = currentUsers.find(user => 
        user.email.toLowerCase() === userData.email.toLowerCase().trim()
      );

      const result = await upsertUser(userData, adminUser.id);
      
      if (result) {
        if (existingUser) {
          updatedCount++;
        } else {
          createdCount++;
        }
      } else {
        errorCount++;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n✅ Processing completed!');
    console.log(`   • Users updated: ${updatedCount}`);
    console.log(`   • Users created: ${createdCount}`);
    console.log(`   • Errors: ${errorCount}`);

    // Get updated state and display summary
    console.log('\n📋 Getting updated database state...');
    const { users: finalUsers, departments: finalDepartments } = await getAllUsersAndDepartments();
    
    displaySummary(finalUsers, finalDepartments);

    console.log('\n🎉 Script completed successfully!');

  } catch (error) {
    console.error('❌ Fatal error occurred:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Export functions for potential reuse
module.exports = {
  manageUsersAndDepartments,
  getAllUsersAndDepartments,
  upsertUser,
  getOrCreateDepartment,
  displaySummary
};

// Run the script if called directly
if (require.main === module) {
  manageUsersAndDepartments().catch(console.error);
}