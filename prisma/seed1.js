const { PrismaClient } = require('@prisma/client');
const { emptyDatabase } = require('./empty-database');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive user data seed...');
  
  // First, empty the database
  await emptyDatabase();
  
  // Reset the prisma client since it was disconnected in emptyDatabase
  await prisma.$connect();

  // Create admin user first
  const adminUser = await prisma.user.upsert({
    where: { email: 'rashid.abbasi@codeninjaconsulting.com' },
    update: {},
    create: {
      email: 'rashid.abbasi@codeninjaconsulting.com',
      firstName: 'Rashid',
      lastName: 'Abbasi',
      role: 'ADMIN',
      gender: 'MALE',
      age: 28,
      phone: '03313817104',
      privacyHideAge: false,
      privacyHideGender: false
    }
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);

  // Create normalized departments
  const departmentData = [
    { name: 'Digital Marketing', createdBy: adminUser.id },
    { name: 'Information Technology', createdBy: adminUser.id },
    { name: 'Marketing', createdBy: adminUser.id },
    { name: 'Professional Engineering Services', createdBy: adminUser.id },
    { name: 'Business Development & Sales', createdBy: adminUser.id },
    { name: 'Human Resources', createdBy: adminUser.id },
    { name: 'Engineering', createdBy: adminUser.id },
    { name: 'Pre-Sales', createdBy: adminUser.id },
    { name: 'Software Development', createdBy: adminUser.id },
    { name: 'Sales', createdBy: adminUser.id },
    { name: 'Cloud Solutions', createdBy: adminUser.id },
    { name: 'Professional Services', createdBy: adminUser.id }
  ];

  const departments = await Promise.all(
    departmentData.map(dept => 
      prisma.department.upsert({
        where: { name: dept.name },
        update: {},
        create: dept
      })
    )
  );

  console.log(`✅ Created ${departments.length} departments`);

  // Helper function to normalize department names
  const normalizeDepartment = (dept) => {
    const normalized = dept.trim().toLowerCase();
    if (normalized.includes('digital marketing')) return 'Digital Marketing';
    if (normalized === 'it' || normalized.includes('it 3e')) return 'Information Technology';
    if (normalized === 'marketing') return 'Marketing';
    if (normalized.includes('pes') || normalized.includes('professional engineering services')) return 'Professional Engineering Services';
    if (normalized.includes('business development') || normalized.includes('sales')) return 'Business Development & Sales';
    if (normalized.includes('hr') || normalized === 'hr') return 'Human Resources';
    if (normalized.includes('engineering') && !normalized.includes('professional')) return 'Engineering';
    if (normalized.includes('pre') && normalized.includes('sales')) return 'Pre-Sales';
    if (normalized.includes('software development') || normalized.includes('development')) return 'Software Development';
    if (normalized === 'sales') return 'Sales';
    if (normalized.includes('cloud')) return 'Cloud Solutions';
    if (normalized.includes('professional service') || normalized === 'ps') return 'Professional Services';
    if (normalized === 'hyper') return 'Professional Services';
    return 'Professional Services'; // Default fallback
  };

  // Create users from CSV data
  const userData = [
    { name: 'Usman Javed', email: 'usman.javed@codeninjaconsulting.com', phone: '03446780068', department: 'Digital Marketing', indoorGame: 'Ludo', outdoorGame: 'Cricket' },
    { name: 'Muhammad Rizwan UL Hassan', email: 'rizwan.hassan@codeninjaconsulting.com', phone: '03235760984', department: 'IT', indoorGame: 'Jenga', outdoorGame: 'Cricket' },
    { name: 'Khawar Zaki', email: 'khawar.zaki@codeninjaconsulting.com', phone: '03460476260', department: 'Marketing', indoorGame: 'UNO', outdoorGame: 'Tug of War' },
    { name: 'Hamid Raza', email: 'hamid.raza@codeninjaconsulting.com', phone: '03364444462', department: 'IT', indoorGame: 'Table Tennis', outdoorGame: 'Futsal' },
    { name: 'Ajlal Haider', email: 'ajlal.haider@codeninjaconsulting.com', phone: '03218600333', department: 'PES', indoorGame: 'Chess', outdoorGame: 'Padel' },
    { name: 'Saad Waqar', email: 'saad@codeninja.sa', phone: '+966566514724', department: 'Business Development & Sales', indoorGame: 'Ludo', outdoorGame: 'Cricket' },
    { name: 'Muhammad Atteeq', email: 'atteeq@codeninjaconsulting.com', phone: '03058031271', department: 'PES', indoorGame: 'Chess', outdoorGame: 'Cricket' },
    { name: 'Muhammad Saad', email: 'muhammad.saad@codeninjaconsulting.com', phone: '03224552116', department: 'HR', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Zaroon Pasha', email: 'zaroon.pasha@codeninjaconsulting.com', phone: '03057418228', department: 'PES', indoorGame: 'Tekken PS5', outdoorGame: 'Padel' },
    { name: 'Marij Shahzad', email: 'marij.shahzad@codeninjaconsulting.com', phone: '03227400066', department: 'Engineering (3E)', indoorGame: 'Tekken PS5', outdoorGame: 'Cricket' },
    { name: 'Sania Abbasi', email: 'sania.abbasi@codeninjaconsulting.com', phone: '03055912084', department: 'PES', indoorGame: 'Ludo', outdoorGame: 'Badminton' },
    { name: 'Shahid Hassan', email: 'shahid.hassan@codeninjaconsulting.com', phone: '03014218432', department: 'HR', indoorGame: 'Tekken PS5', outdoorGame: 'Cricket' },
    { name: 'Muhammad Usman', email: 'm.usman@codeninjaconsulting.com', phone: '03224939733', department: 'Pre Sales', indoorGame: 'UNO', outdoorGame: 'Badminton' },
    { name: 'Muhammad Raffay Raheel', email: 'raffay.raheel@codeninjaconsulting.com', phone: '+923324505235', department: 'Pre-sales', indoorGame: 'Fifa PS5', outdoorGame: 'Badminton' },
    { name: 'Umer Ayaz', email: 'umer.ayaz@codeninjaconsulting.com', phone: '03134512652', department: 'Engineering', indoorGame: 'Jenga', outdoorGame: 'Cricket' },
    { name: 'Amna Irfan', email: 'amna.irfan@codeninjaconsulting.com', phone: '03316157597', department: 'Professional Engineering Services', indoorGame: 'Chess', outdoorGame: 'Badminton' },
    { name: 'Haris Shahid', email: 'haris.shahid@codeninjaconsulting.com', phone: '03158453515', department: 'PES', indoorGame: 'Table Tennis', outdoorGame: 'Padel' },
    { name: 'Junaid Alam', email: 'junaid.alam@codeninjaconsulting.com', phone: '03074522293', department: 'Software Development (PES)', indoorGame: 'Sequence', outdoorGame: 'Padel' },
    { name: 'Shiza Khan', email: 'shiiza.khan@codeninjaconsulting.com', phone: '03125257518', department: 'HR', indoorGame: 'Darts', outdoorGame: 'Badminton' },
    { name: 'Humza Khan', email: 'humza.khan@codeninjaconsulting.com', phone: '03228021254', department: 'Sales', indoorGame: 'Playing Cards', outdoorGame: 'Cricket' },
    { name: 'Muhammad Ali Abbas', email: 'muhammad.ali@codeninjaconsulting.com', phone: '03334608625', department: 'Marketing', indoorGame: 'Fifa PS5', outdoorGame: 'Futsal' },
    { name: 'Rafia Sajid', email: 'rafia.sajid@codeninjaconsulting.com', phone: '03181795005', department: 'HYPER', indoorGame: 'Ludo', outdoorGame: 'Badminton' },
    { name: 'Saad Ameer', email: 'saad.ameer@codeninjaconsulting.com', phone: '03164839686', department: 'PES', indoorGame: 'Table Tennis', outdoorGame: 'Padel' },
    { name: 'Sikandar Sultan', email: 'sikandar.sultan@codeninjaconsulting.com', phone: '03054574237', department: 'PES', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Hamza Akhter', email: 'hamza.akhter@codeninjaconsulting.com', phone: '03060670689', department: 'Cloud solutions', indoorGame: 'Chess', outdoorGame: 'Badminton' },
    { name: 'Nauman Ahmad', email: 'nauman.ahmad@codeninjaconsulting.com', phone: '03334052722', department: 'IT 3E', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Muhammad Mohsin', email: 'muhammad.mohsin@codeninjaconsulting.com', phone: '03452113382', department: 'PES', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Tehreem Fatima', email: 'tehreem.fatima@codeninjaconsulting.com', phone: '03044633396', department: 'PS', indoorGame: 'Playing Cards', outdoorGame: 'Badminton' },
    { name: 'Qadir Bukhsh', email: 'qadir.bukhsh@codeninjaconsulting.com', phone: '03214634841', department: 'Professional Services', indoorGame: 'Jenga', outdoorGame: 'Tug of War' },
    { name: 'Jawad Ijaz', email: 'jawad.ijaz@codeninjaconsulting.com', phone: '03063792478', department: 'PES', indoorGame: 'Table Tennis', outdoorGame: 'Badminton' },
    { name: 'Adil Zafar', email: 'adil.zafar@codeninjaconsulting.com', phone: '03091940039', department: 'PES', indoorGame: 'Sequence', outdoorGame: 'Cricket' },
    { name: 'Abdur Rehman Asif', email: 'Abdur.rehman@codeninjaconsulting.com', phone: '03304641960', department: 'PES', indoorGame: 'Table Tennis', outdoorGame: 'Futsal' },
    { name: 'Sikander Raheem', email: 'sikander.raheem@codeninjaconsulting.com', phone: '03219487277', department: '3E Engineering', indoorGame: 'Table Tennis', outdoorGame: 'Badminton' },
    { name: 'Rana Waqas', email: 'Rana.waqas@codeninjaconsulting.com', phone: '03179981050', department: 'PES', indoorGame: 'Sequence', outdoorGame: 'Padel' },
    { name: 'Muhammad Talha Aleem', email: 'Muhammad_talha@codeninjaconsulting.com', phone: '03104188537', department: 'Professional service', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Muhammad Huzefa Abbasi', email: 'huzefa.abbasi@codeninjaconsulting.com', phone: '03328187814', department: '3E', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Muhammad Sheharyar Ajmal', email: 'sheharyar.ajmal@codeninjaconsulting.com', phone: '03029576647', department: 'PES', indoorGame: 'Sequence', outdoorGame: 'Padel' },
    { name: 'Owais Mabood', email: 'owais.mabood@codeninjaconsulting.com', phone: '03369123686', department: '3E', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Akbar Ali', email: 'akbar.ali@codeninjaconsulting.com', phone: '03071378889', department: 'PS', indoorGame: 'Table Tennis', outdoorGame: 'Cricket' },
    { name: 'Haseeb Zia', email: 'haseeb.zia@codeninjaconsulting.com', phone: '03201426933', department: 'Sales', indoorGame: 'Table Tennis', outdoorGame: 'Padel' }
  ];

  // Create users with proper department relationships
  const users = [];
  for (const user of userData) {
    const [firstName, ...lastNameParts] = user.name.split(' ');
    const lastName = lastNameParts.join(' ');
    const normalizedDeptName = normalizeDepartment(user.department);
    const department = departments.find(d => d.name === normalizedDeptName);

    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        firstName,
        lastName,
        role: 'USER',
        gender: 'PREFER_NOT_TO_SAY',
        age: Math.floor(Math.random() * 15) + 25, // Random age between 25-40
        phone: user.phone,
        departmentId: department?.id,
        privacyHideAge: false,
        privacyHideGender: false
      }
    });
    users.push({ ...createdUser, indoorGame: user.indoorGame, outdoorGame: user.outdoorGame });
  }

  console.log(`✅ Created ${users.length} users`);

  // Create categories for Indoor and Outdoor Games with perPersonCap
  const indoorStartDate = new Date('2025-09-29T00:00:00Z');
  const indoorEndDate = new Date('2025-10-02T23:59:59Z');
  const indoorRegistrationDeadline = new Date('2025-09-28T23:59:59Z');

  const outdoorStartDate = new Date('2025-10-03T00:00:00Z');
  const outdoorEndDate = new Date('2025-10-03T23:59:59Z');
  const outdoorRegistrationDeadline = new Date('2025-10-02T23:59:59Z');

  const indoorCategory = await prisma.category.upsert({
    where: { id: 'indoor-games-category' },
    update: {},
    create: {
      id: 'indoor-games-category',
      name: 'Indoor Games',
      gamesCountMode: 'PER_USER',
      startDate: indoorStartDate,
      endDate: indoorEndDate,
      dailyWindows: JSON.stringify([
        { day: '2025-09-29', start: '13:00', end: '15:00' },
        { day: '2025-09-30', start: '13:00', end: '15:00' },
        { day: '2025-10-01', start: '13:00', end: '15:00' },
        { day: '2025-10-02', start: '13:00', end: '15:00' }
      ]),
      perPersonCap: 2147483647, // Maximum integer value for unlimited indoor games per person
      locationName: 'Office',
      locationMapsLink: 'https://maps.google.com/?q=Office',
      status: 'ACTIVE',
      createdBy: adminUser.id,
      registrationDeadline: indoorRegistrationDeadline
    }
  });

  const outdoorCategory = await prisma.category.upsert({
    where: { id: 'outdoor-games-category' },
    update: {},
    create: {
      id: 'outdoor-games-category',
      name: 'Outdoor Games',
      gamesCountMode: 'PER_USER',
      startDate: outdoorStartDate,
      endDate: outdoorEndDate,
      dailyWindows: JSON.stringify([
        { day: '2025-10-03', start: '19:00', end: '21:00' }
      ]),
      perPersonCap: 2, // Maximum 2 outdoor games per person
      locationName: '5th Generation Sports Complex',
      locationMapsLink: 'https://maps.google.com/?q=5th+Generation+Sports+Complex',
      status: 'ACTIVE',
      createdBy: adminUser.id,
      registrationDeadline: outdoorRegistrationDeadline
    }
  });

  console.log(`✅ Created categories: ${indoorCategory.name}, ${outdoorCategory.name}`);

  // Create games with appropriate typeFormat and contestType
  const indoorGamesData = [
    { id: 'game-ludo', name: 'Ludo', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '1v1', avgGameTime: 30, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 15, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-jenga', name: 'Jenga', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '1v1', avgGameTime: 15, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 10, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-uno', name: 'UNO', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '1v1', avgGameTime: 20, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 10, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-table-tennis', name: 'Table Tennis', categoryId: indoorCategory.id, weightage: 1.5, typeFormat: '1v1', avgGameTime: 45, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 30, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-chess', name: 'Chess', categoryId: indoorCategory.id, weightage: 1.2, typeFormat: '1v1', avgGameTime: 60, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 15, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-tekken-ps5', name: 'Tekken PS5', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '1v1', avgGameTime: 15, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 10, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-fifa-ps5', name: 'Fifa PS5', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '1v1', avgGameTime: 30, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 15, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-sequence', name: 'Sequence', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '2v2', avgGameTime: 30, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'ROUND_ROBIN', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 15, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-darts', name: 'Darts', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '1v1', avgGameTime: 20, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 10, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-playing-cards', name: 'Playing Cards', categoryId: indoorCategory.id, weightage: 1.0, typeFormat: '1v1', avgGameTime: 30, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 15, backToBackAllowed: false, simultaneousGames: 1 }
  ];

  const outdoorGamesData = [
    { id: 'game-cricket', name: 'Cricket', categoryId: outdoorCategory.id, weightage: 2.0, typeFormat: 'Team', avgGameTime: 120, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SCORING', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 60, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-tug-of-war', name: 'Tug of War', categoryId: outdoorCategory.id, weightage: 1.5, typeFormat: 'Team', avgGameTime: 30, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SCORING', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 30, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-futsal', name: 'Futsal', categoryId: outdoorCategory.id, weightage: 2.0, typeFormat: '5v5', avgGameTime: 90, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SCORING', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 45, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-padel', name: 'Padel', categoryId: outdoorCategory.id, weightage: 1.5, typeFormat: '2v2', avgGameTime: 60, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'ROUND_ROBIN', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 30, backToBackAllowed: false, simultaneousGames: 1 },
    { id: 'game-badminton', name: 'Badminton', categoryId: outdoorCategory.id, weightage: 1.5, typeFormat: '1v1', avgGameTime: 45, levels: '["BEGINNER","INTERMEDIATE","ADVANCED"]', contestType: 'SINGLE_ELIMINATION', seedingMethod: 'RANDOM', courtsRequiredPerMatch: 1, minRestMinutes: 30, backToBackAllowed: false, simultaneousGames: 1 }
  ];

  // Create all games
  const allGamesData = [...indoorGamesData, ...outdoorGamesData];
  const games = await Promise.all(
    allGamesData.map(game => 
      prisma.game.upsert({
        where: { id: game.id },
        update: {},
        create: {
          ...game,
          createdBy: adminUser.id,
          description: `Exciting game of ${game.name} for the sports week!`
        }
      })
    )
  );

  console.log(`✅ Created ${games.length} games`);

  // Create registrations - now handled by the perPersonCap field in categories
  const registrations = [];
  
  for (const user of users) {
    // Register for indoor game (unlimited due to perPersonCap: 2147483647)
    const indoorGame = games.find(g => g.name === user.indoorGame);
    if (indoorGame) {
      try {
        const indoorRegistration = await prisma.registration.upsert({
          where: { 
            userId_gameId: {
              userId: user.id,
              gameId: indoorGame.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            gameId: indoorGame.id,
            level: 'INTERMEDIATE',
            mode: 'INDIVIDUAL'
          }
        });
        registrations.push(indoorRegistration);
      } catch (e) {
        console.log(`⚠️ Registration already exists for user ${user.email} in indoor game ${indoorGame.name}`);
      }
    }

    // Register for outdoor game (limited to 2 due to perPersonCap: 2)
    const outdoorGame = games.find(g => g.name === user.outdoorGame);
    if (outdoorGame) {
      try {
        const outdoorRegistration = await prisma.registration.upsert({
          where: { 
            userId_gameId: {
              userId: user.id,
              gameId: outdoorGame.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            gameId: outdoorGame.id,
            level: 'INTERMEDIATE',
            mode: 'INDIVIDUAL'
          }
        });
        registrations.push(outdoorRegistration);
      } catch (e) {
        console.log(`⚠️ Registration already exists for user ${user.email} in outdoor game ${outdoorGame.name}`);
      }
    }
  }

  console.log(`✅ Created ${registrations.length} registrations`);

  console.log('🎉 Comprehensive user data seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Admin User: 1`);
  console.log(`- Departments: ${departments.length}`);
  console.log(`- Users: ${users.length}`);
  console.log(`- Categories: 2`);
  console.log(`- Games: ${games.length}`);
  console.log(`- Registrations: ${registrations.length}`);
  console.log('\n🚀 System is ready with comprehensive user data!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });