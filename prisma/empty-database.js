const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function emptyDatabase() {
  try {
    console.log('Starting to empty the database...');
    
    // Delete from tables in correct order to handle foreign key constraints
    await prisma.gameReminder.deleteMany();
    await prisma.match.deleteMany();
    await prisma.slot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.team.deleteMany();
    await prisma.game.deleteMany();
    await prisma.category.deleteMany();
    await prisma.newsReaction.deleteMany();
    await prisma.news.deleteMany();
    await prisma.reaction.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.emailLog.deleteMany();
    await prisma.auditLog.deleteMany();
    
    // Break circular references between users and departments using raw SQL
    // Update all users to remove department references
    await prisma.$executeRaw`UPDATE "users" SET "departmentId" = NULL WHERE "departmentId" IS NOT NULL`;
    
    // Now we can safely delete departments and users
    await prisma.department.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('Database emptied successfully!');
  } catch (error) {
    console.error('Error emptying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Export the function so it can be imported by other scripts
module.exports = { emptyDatabase };