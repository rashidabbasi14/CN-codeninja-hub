const { PrismaClient } = require('@prisma/client');
const { emptyDatabase } = require('./empty-database');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive user data seed...');
  
  // First, empty the database
  // await emptyDatabase();
  
  // Reset the prisma client since it was disconnected in emptyDatabase
  await prisma.$connect();

  
  const adminUser = { id: "cmfywap9d0000vu50lcuhfz0y" };

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
        create: {
          name: dept.name,
          creator: {
            connect: { id: dept.createdBy }
          }
        }
      })
    )
  );

  console.log(`✅ Created ${departments.length} departments`);

  // Helper function to normalize department names
  const normalizeDepartment = (dept) => {
    const normalized = dept.trim().toLowerCase();
    // Digital Marketing
    if (normalized.includes('digital marketing')) return 'Digital Marketing';
    
    // Information Technology
    if (normalized === 'it' || normalized.includes('it 3e')) return 'Information Technology';
    
    // Marketing
    if (normalized.includes('marketing') && !normalized.includes('business development')) return 'Marketing';
    
    // Professional Engineering Services
    if (normalized.includes('professional engineering services')) return 'Professional Engineering Services';
    
    // Business Development & Sales
    if (normalized.includes('business development')) return 'Business Development & Sales';
    
    // Human Resources
    if (normalized.includes('hr')) return 'Human Resources';
    
    // Engineering
    if (normalized.includes('engineering') && !normalized.includes('professional')) return 'Engineering';
    if (normalized === 'dev' || normalized === 'development') return 'Engineering';
    
    // Pre-Sales
    if (normalized.includes('pre') && normalized.includes('sales')) return 'Pre-Sales';
    if (normalized === 'pre sales' || normalized === 'pre-sales') return 'Pre-Sales';
    
    // Software Development
    if (normalized.includes('software development')) return 'Software Development';
    
    // Sales
    if (normalized === 'sales' || normalized.includes('sales / ae / huzaifa')) return 'Sales';
    
    // Cloud Solutions
    if (normalized.includes('cloud') || normalized.includes('cloud solutions')) return 'Cloud Solutions';
    
    // Professional Services (catch-all for various variations)
    if (normalized.includes('pes') ||
        normalized.includes('professional service') ||
        normalized === 'ps' ||
        normalized === 'hyper' ||
        normalized.includes('3e') ||
        normalized.includes('pse') ||
        normalized.includes('staff augmentation')) return 'Professional Services';
    
    return 'Professional Services'; // Default fallback
  };

  // Create users from CSV data
  const userData = [
    { name: 'Usman Javed', email: 'usman.javed@codeninjaconsulting.com', phone: '3446780068', department: 'Digital Marketing ', indoorGames: ['Ludo', 'Playing Cards', 'UNO'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Muhammad Rizwan UL Hassan', email: 'rizwan.hassan@codeninjaconsulting.com', phone: '3235760984', department: 'IT', indoorGames: ['Jenga', 'Ludo', 'Playing Cards'], outdoorGames: ['Cricket', 'Tug of War'] },
    { name: 'Khawar Zaki', email: 'khawar.zaki@codeninjaconsulting.com', phone: '3460476260', department: 'Marketing', indoorGames: ['UNO', 'Ludo', 'Chess'], outdoorGames: ['Tug of War', ''] },
    { name: 'Hamid Raza', email: 'hamid.raza@codeninjaconsulting.com', phone: '03364444462', department: 'IT', indoorGames: ['Table Tennis', 'Tekken PS5', 'Chess'], outdoorGames: ['Futsal', 'Badminton'] },
    { name: 'Ajlal Haider', email: 'ajlal.haider@codeninjaconsulting.com', phone: '3218600333', department: 'PES', indoorGames: ['Chess', 'Tekken PS5', 'Table Tennis'], outdoorGames: ['Padel', 'Tug of War'] },
    { name: 'Saad Waqar', email: 'saad@codeninja.sa', phone: '966566514724', department: 'Business Development & Sales', indoorGames: ['Ludo', '', ''], outdoorGames: ['Cricket', ''] },
    { name: 'Muhammad Atteeq', email: 'atteeq@codeninjaconsulting.com', phone: '3058031271', department: 'PES', indoorGames: ['Chess', 'Darts', ''], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Muhammad Saad', email: 'muhammad.saad@codeninjaconsulting.com', phone: '3224552116', department: 'HR', indoorGames: ['Table Tennis', 'Tekken PS5', 'Ludo'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Marij Shahzad', email: 'marij.shahzad@codeninjaconsulting.com', phone: '3227400066', department: 'Engineering (3E)', indoorGames: ['Tekken PS5', 'Table Tennis', 'Jenga'], outdoorGames: ['Cricket', 'Futsal'] },
    { name: 'Shahid Hassan', email: 'shahid.hassan@codeninjaconsulting.com', phone: '3014218432', department: 'HR', indoorGames: ['Tekken PS5', 'Table Tennis', 'Tekken PS5'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Rashid Abbasi', email: 'Rashid.abbasi@codeninjaconsulting.com', phone: '3313817104', department: 'Professional Engineering Services', indoorGames: ['Table Tennis', 'Darts', 'Chess'], outdoorGames: ['Padel', 'Futsal'] },
    { name: 'Muhammad Usman', email: 'm.usman@codeninjaconsulting.com', phone: '3224939733', department: 'Pre Sales', indoorGames: ['UNO', 'Ludo', 'Tekken PS5'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Muhammad Raffay Raheel', email: 'raffay.raheel@codeninjaconsulting.com', phone: '+923324505235', department: 'Pre-sales', indoorGames: ['Fifa PS5', 'Sequence', 'Tekken PS5'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Umer Ayaz', email: 'umer.ayaz@codeninjaconsulting.com', phone: '0313-4512652', department: 'Engineering', indoorGames: ['Jenga', 'Ludo', ''], outdoorGames: ['Cricket', ''] },
    { name: 'Amna Irfan', email: 'amna.irfan@codeninjaconsulting.com', phone: '3316157597', department: 'Professional Engineering Services', indoorGames: ['Chess', 'Sequence', 'Playing Cards'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Haris Shahid', email: 'haris.shahid@codeninjaconsulting.com', phone: '3158453515', department: 'PES', indoorGames: ['Table Tennis', 'UNO', 'Playing Cards'], outdoorGames: ['Padel', 'Futsal'] },
    { name: 'Junaid Alam', email: 'junaid.alam@codeninjaconsulting.com', phone: '3074522293', department: 'Software Development (PES)', indoorGames: ['Sequence', 'Table Tennis', 'Darts'], outdoorGames: ['Padel', 'Badminton'] },
    { name: 'Shiza Khan', email: 'shiiza.khan@codeninjaconsulting.com', phone: '3125257518', department: 'HR', indoorGames: ['Darts', 'UNO', 'Jenga'], outdoorGames: ['Badminton', 'Tug of War'] },
    { name: 'Humza Khan', email: 'humza.khan@codeninjaconsulting.com', phone: '3228021254', department: 'Sales', indoorGames: ['Playing Cards', '', ''], outdoorGames: ['Cricket', 'Futsal'] },
    { name: 'Muhammad Ali Abbas', email: 'muhammad.ali@codeninjaconsulting.com', phone: '3334608625', department: 'Marketing', indoorGames: ['Fifa PS5', 'Chess', 'Playing Cards'], outdoorGames: ['Futsal', 'Padel'] },
    { name: 'Rafia Sajid', email: 'rafia.sajid@codeninjaconsulting.com', phone: '3181795005', department: 'HYPER', indoorGames: ['Ludo', 'Sequence', 'Jenga'], outdoorGames: ['Badminton', ''] },
    { name: 'Saad Ameer', email: 'saad.ameer@codeninjaconsulting.com', phone: '3164839686', department: 'PES', indoorGames: ['Table Tennis', '', ''], outdoorGames: ['Padel', ''] },
    { name: 'Sikandar Sultan', email: 'sikandar.sultan@codeninjaconsulting.com', phone: '0305-4574237', department: 'PES', indoorGames: ['Table Tennis', 'Jenga', 'Ludo'], outdoorGames: ['Cricket', 'Badminton'] },
    { name: 'Hamza Akhter', email: 'hamza.akhter@codeninjaconsulting.com', phone: '3060670689', department: 'Cloud solutions', indoorGames: ['Chess', 'Table Tennis', 'Tekken PS5'], outdoorGames: ['Badminton', 'Cricket'] },
    { name: 'Nauman Ahmad', email: 'nauman.ahmad@codeninjaconsulting.com', phone: '3334052722', department: 'IT 3E', indoorGames: ['Table Tennis', '', ''], outdoorGames: ['Cricket', ''] },
    { name: 'Muhammad Mohsin', email: 'muhammad.mohsin@codeninjaconsulting.com', phone: '3452113382', department: 'PES', indoorGames: ['Table Tennis', 'Tekken PS5', 'Chess'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Tehreem Fatima', email: 'tehreem.fatima@codeninjaconsulting.com', phone: '3044633396', department: 'PS', indoorGames: ['Playing Cards', 'Jenga', 'Tekken PS5'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Qadir Bukhsh', email: 'qadir.bukhsh@codeninjaconsulting.com', phone: '3214634841', department: 'Professional Services', indoorGames: ['Jenga', 'Playing Cards', 'Sequence'], outdoorGames: ['Tug of War', 'Badminton'] },
    { name: 'Jawad Ijaz', email: 'jawad.ijaz@codeninjaconsulting.com', phone: '3063792478', department: 'PES', indoorGames: ['Table Tennis', 'Jenga', 'Ludo'], outdoorGames: ['Badminton', 'Tug of War'] },
    { name: 'Adil Zafar', email: 'adil.zafar@codeninjaconsulting.com', phone: '3091940039', department: 'PES', indoorGames: ['Sequence', 'Playing Cards', 'Jenga'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Abdur Rehman Asif', email: 'Abdur.rehman@codeninjaconsulting.com', phone: '3304641960', department: 'PES', indoorGames: ['Table Tennis', 'Fifa PS5', 'Playing Cards'], outdoorGames: ['Futsal', 'Tug of War'] },
    { name: 'Sikander Raheem', email: 'sikander.raheem@codeninjaconsulting.com', phone: '3219487277', department: '3E Engineering', indoorGames: ['Table Tennis', 'Sequence', 'Jenga'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Rana Waqas', email: 'Rana.waqas@codeninjaconsulting.com', phone: '3179981050', department: 'PES', indoorGames: ['Sequence', 'Fifa PS5', 'Table Tennis'], outdoorGames: ['Padel', 'Futsal'] },
    { name: 'Muhammad Talha Aleem', email: 'Muhammad_talha@codeninjaconsulting.com', phone: '3104188537', department: 'Professional service', indoorGames: ['Table Tennis', '', ''], outdoorGames: ['Cricket', 'Badminton'] },
    { name: 'Muhammad Huzefa Abbasi', email: 'huzefa.abbasi@codeninjaconsulting.com', phone: '3328187814', department: '3E', indoorGames: ['Table Tennis', 'Darts', 'Fifa PS5'], outdoorGames: ['Cricket', 'Futsal'] },
    { name: 'Muhammad Sheharyar Ajmal', email: 'sheharyar.ajmal@codeninjaconsulting.com', phone: '3029576647', department: 'PES', indoorGames: ['Sequence', 'Jenga', 'Fifa PS5'], outdoorGames: ['Padel', 'Cricket'] },
    { name: 'Owais Mabood', email: 'owais.mabood@codeninjaconsulting.com', phone: '3369123686', department: '3E', indoorGames: ['Table Tennis', 'Tekken PS5', 'Chess'], outdoorGames: ['Cricket', 'Futsal'] },
    { name: 'Akbar Ali', email: 'akbar.ali@codeninjaconsulting.com', phone: '3071378889', department: 'PS', indoorGames: ['Table Tennis', '', ''], outdoorGames: ['Cricket', ''] },
    { name: 'Haseeb Zia', email: 'haseeb.zia@codeninjaconsulting.com', phone: '3201426933', department: 'Sales', indoorGames: ['Table Tennis', 'Fifa PS5', ''], outdoorGames: ['Padel', 'Futsal'] },
    { name: 'Taimoor Hussain', email: 'taimoor.hussain@codeninjaconsulting.com', phone: '92317003800', department: 'Marketing ', indoorGames: ['Table Tennis', 'Fifa PS5', ''], outdoorGames: ['Futsal', 'Cricket'] },
    { name: 'Zara Naeem', email: 'zara.naeem@codeninjaconsulting.com', phone: '3214251978', department: 'PES', indoorGames: ['Ludo', 'Jenga', 'UNO'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Umer Ameer', email: 'umer.ameer@codeninjaconsulting.com', phone: '3007532036', department: 'Marketing ', indoorGames: ['Ludo', 'UNO', 'Jenga'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Dilawaiz', email: 'dilawaiz@codeninjaconsulting.com', phone: '3317350877', department: 'Sales', indoorGames: ['Ludo', 'Jenga', 'Playing Cards'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Moiz Ahmed', email: 'moiz.ahmed@codeninjaconsulting.com', phone: '3244506507', department: 'Marketing ', indoorGames: ['Ludo', 'Jenga', ''], outdoorGames: ['Badminton', ''] },
    { name: 'Yusra Sarmad Khan', email: 'Yusra.sarmad@codeninjaconsulting.com', phone: '923249000000', department: '3E ', indoorGames: ['Jenga', 'Ludo', 'Tekken PS5'], outdoorGames: ['Padel', 'Tug of War'] },
    { name: 'Zulqarnain Haider', email: 'zulqarnain.haider@codeninjaconsulting.com', phone: '0323-9932656', department: 'dev', indoorGames: ['Table Tennis', 'Jenga', 'Tekken PS5'], outdoorGames: ['Futsal', 'Badminton'] },
    { name: 'Abdullah Nasir', email: 'abdullah.nasir@codeninjaconsulting.com', phone: '3343833303', department: 'PES', indoorGames: ['Table Tennis', 'Fifa PS5', 'UNO'], outdoorGames: ['Padel', 'Cricket'] },
    { name: 'Khizar Ali', email: 'khizar.ali@codeninjaconsulting.com', phone: '3117611752', department: 'Staff Augmentation 3E', indoorGames: ['Tekken PS5', 'UNO', ''], outdoorGames: ['Cricket', 'Badminton'] },
    { name: 'Muhammad Bilal Tariq', email: 'bilal.tariq@codeninjaconsulting.com', phone: '3199322400', department: 'PSE', indoorGames: ['Tekken PS5', 'Jenga', 'Table Tennis'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Abdullah Mukhtar', email: 'abdullah.mukhtar@codeninjaconsulting.com', phone: '3313088291', department: 'PES', indoorGames: ['Playing Cards', 'Ludo', 'Jenga'], outdoorGames: ['Futsal', 'Padel'] },
    { name: 'Huma Fayyaz', email: 'huma.fayyaz@codeninjaconsulting.com', phone: '3238412151', department: 'Marketing', indoorGames: ['Jenga', 'Sequence', 'Tekken PS5'], outdoorGames: ['Tug of War', 'Padel'] },
    { name: 'Shaharyar Khan', email: 'shaharyar.khan@codeninjaconsulting.com', phone: '3077006777', department: 'Sales', indoorGames: ['Chess', '', ''], outdoorGames: ['Padel', ''] },
    { name: 'Ayesha Naz', email: 'ayesha.naz@codeninjaconsulting.com', phone: '90078601', department: 'HR ', indoorGames: ['Ludo', 'Jenga', 'Tekken PS5'], outdoorGames: ['Padel', 'Badminton'] },
    { name: 'Munazza Hashmi', email: 'munazza.hashmi@codeninjaconsulting.com', phone: '3334219557', department: 'HR', indoorGames: ['Sequence', 'Darts', 'Tekken PS5'], outdoorGames: ['Padel', 'Badminton'] },
    { name: 'Nouman Noor', email: 'nouman.noor@codeninjaconsulting.com', phone: '3230469605', department: 'Marketing', indoorGames: ['Ludo', '', ''], outdoorGames: ['Badminton', ''] },
    { name: 'Ahmed Ghaffar', email: 'ahmed.ghaffar@codeninjaconsulting.com', phone: '3046693241', department: 'PES', indoorGames: ['Table Tennis', 'Tekken PS5', 'Ludo'], outdoorGames: ['Cricket', 'Tug of War'] },
    { name: 'Bilal Butt', email: 'Bilal.butt@codeninjaconsulting.com', phone: '3260334868', department: 'Marketing', indoorGames: ['Fifa PS5', 'Tekken PS5', 'Jenga'], outdoorGames: ['Badminton', ''] },
    { name: 'Muhammad Umer', email: 'muhammad.umer@codeninjaconsulting.com', phone: '3368655255', department: 'PES', indoorGames: ['Playing Cards', '', ''], outdoorGames: ['Tug of War', ''] },
    { name: 'Sania Abbasi', email: 'sania.abbasi@codeninjaconsulting.com', phone: '3055912084', department: 'PES', indoorGames: ['Ludo', 'UNO', 'Table Tennis'], outdoorGames: ['Badminton', 'Cricket'] },
    { name: 'Zaroon Pasha', email: 'zaroon.pasha@codeninjaconsulting.com', phone: '3057418228', department: 'PES', indoorGames: ['Table Tennis', 'UNO', 'Darts'], outdoorGames: ['Padel', 'Futsal'] },
    { name: 'Mubeen', email: 'mubeen@codeninjaconsulting.com', phone: '3171167678', department: 'Engineering', indoorGames: ['Chess', '', ''], outdoorGames: ['', ''] },
    { name: 'Awais Haqani', email: 'awais.haqani@codeninjaconsulting.com', phone: '923158000000', department: 'Engineering', indoorGames: ['Chess', 'Table Tennis', 'Tekken PS5'], outdoorGames: ['Futsal', 'Cricket'] },
    { name: 'Faizan Gulzar', email: 'faizan.gulzar@codeninjaconsulting.com', phone: '3244224403', department: 'PES', indoorGames: ['Ludo', 'Table Tennis', 'Playing Cards'], outdoorGames: ['Badminton', 'Badminton'] },
    { name: 'Hassan Wasim', email: 'hassan.wasim@codeninjaconsulting.com', phone: '3099206717', department: 'Sales', indoorGames: ['Table Tennis', 'Tekken PS5', 'Sequence'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Usama Tariq', email: 'usama.tariq@codeninjaconsulting.com', phone: '3324359845', department: 'HR', indoorGames: ['Darts', 'Sequence', 'Tekken PS5'], outdoorGames: ['', ''] },
    { name: 'Mutahir Hashmi', email: 'mutahir.hashmi@codeninjaconsulting.com', phone: '3330740468', department: 'Sales', indoorGames: ['Table Tennis', 'Fifa PS5', 'Jenga'], outdoorGames: ['Badminton', 'Padel'] },
    { name: 'Ahmad Sultan', email: 'ahmad.sultan@codeninjaconsulting.com', phone: '923017000000', department: 'Development', indoorGames: ['Table Tennis', 'Darts', 'Playing Cards'], outdoorGames: ['Cricket', 'Padel'] },
    { name: 'Bareera Shahbaz Ali Malik', email: 'Bareera.shahbaz@codeninjaconsulting.com', phone: '3344507296', department: 'Sales', indoorGames: ['Jenga', 'Sequence', ''], outdoorGames: ['Badminton', ''] },
    { name: 'Talha Ashfaq', email: 'talha.ashfaq@codeninjaconsulting.com', phone: '3218479367', department: 'Sales', indoorGames: ['Ludo', 'UNO', 'Jenga'], outdoorGames: ['Futsal', 'Badminton'] },
    { name: 'Hassan Asghar', email: 'hassan.asghar@codeninjaconsulting.com', phone: '3014859944', department: 'PES', indoorGames: ['Ludo', 'Playing Cards', 'Tekken PS5'], outdoorGames: ['Cricket', 'Tug of War'] },
    { name: 'Huzaifa Zulfiqar', email: 'huzaifa.zulfiqar@codeninjaconsulting.com', phone: '3177171471', department: 'Sales ', indoorGames: ['Fifa PS5', 'Tekken PS5', 'Ludo'], outdoorGames: ['Cricket', 'Futsal'] },
    { name: 'Arslan Ahmad', email: 'arslan.ahmad@codeninjaconsulting.com', phone: '3344050906', department: 'Sales / AE / Huzaifa\'s Team', indoorGames: ['Sequence', 'Jenga', 'Ludo'], outdoorGames: ['Futsal', 'Badminton'] },
    { name: 'Muhammad Ibrahim Bin Ali', email: 'ibrahim.ali@codeninjaconsulting.com', phone: '0318-0476789', department: 'Sales', indoorGames: ['Table Tennis', 'Tekken PS5', 'Sequence'], outdoorGames: ['Padel', 'Cricket'] },
    { name: 'Amna Suheyl', email: 'amna.suheyl@codeninjaconsulting.com', phone: '3244791151', department: 'Marketing', indoorGames: ['Jenga', 'Ludo', 'Darts'], outdoorGames: ['Badminton', ''] }
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
    users.push({ ...createdUser, indoorGames: user.indoorGames, outdoorGames: user.outdoorGames });
  }

  console.log(`✅ Created ${users.length} users`);

  // Fetch existing games from the database
  const games = await prisma.game.findMany();
  console.log(`✅ Fetched ${games.length} existing games from database`);

  // Create registrations - now handled by the perPersonCap field in categories
  const registrations = [];
  
  for (const user of users) {
    // Register for all indoor games (unlimited due to perPersonCap: 2147483647)
    for (const indoorGameName of user.indoorGames) {
      if (indoorGameName) { // Skip empty game preferences
        const indoorGame = games.find(g => g.name === indoorGameName);
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
                level: 'Intermediate',
                mode: 'INDIVIDUAL'
              }
            });
            registrations.push(indoorRegistration);
          } catch (e) {
            console.log(`⚠️ Registration already exists for user ${user.email} in indoor game ${indoorGame.name}`);
          }
        }
      }
    }

    // Register for all outdoor games (limited to 2 due to perPersonCap: 2)
    for (const outdoorGameName of user.outdoorGames) {
      if (outdoorGameName) { // Skip empty game preferences
        const outdoorGame = games.find(g => g.name === outdoorGameName);
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
                level: 'Intermediate',
                mode: 'INDIVIDUAL'
              }
            });
            registrations.push(outdoorRegistration);
          } catch (e) {
            console.log(`⚠️ Registration already exists for user ${user.email} in outdoor game ${outdoorGame.name}`);
          }
        }
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