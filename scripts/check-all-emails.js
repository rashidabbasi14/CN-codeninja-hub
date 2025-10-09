const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// All emails from the provided list (duplicates will be removed automatically)
const ALL_EMAILS = [
  'abdul.ghaffar@codeninjaconsulting.com',
  'hamza.khan@codeninjaconsulting.com',
  'abdul.rehman@codeninjaconsulting.com',
  'abdullah.mukhtar@codeninjaconsulting.com',
  'abdullah.qureshi@codeninjaconsulting.com',
  'Abdur.rehman@codeninjaconsulting.com',
  'adeel.mirza@codeninjaconsulting.com',
  'adil@codeninjaconsulting.com',
  'adil.zafar@codeninjaconsulting.com',
  'adnan.jamshed@codeninjaconsulting.com',
  'ahmad.murtaza@codeninjaconsulting.com',
  'ahmad.sultan@codeninjaconsulting.com',
  'ahmed.ghaffar@codeninjaconsulting.com',
  'akbar.ali@codeninjaconsulting.com',
  'ali.awan@codeninjaconsulting.com',
  'ali.imran@codeninjaconsulting.com',
  'ali.razaa@codeninjaconsulting.com',
  'amna.irfan@codeninjaconsulting.com',
  'amna.suheyl@codeninjaconsulting.com',
  'arfa.mujahid@codeninjaconsulting.com',
  'arslan.ahmad@codeninjaconsulting.com',
  'arslan.butt@codeninjaconsulting.com',
  'asad.jamil@codeninjaconsulting.com',
  'asad.khan@codeninjaconsulting.com',
  'asim.khalil@codeninjaconsulting.com',
  'awais.altaf@codeninjaconsulting.com',
  'awais.haqani@codeninjaconsulting.com',
  'ayan.ashraf@codeninjaconsulting.com',
  'ayesha.naz@codeninjaconsulting.com',
  'Bareera.shahbaz@codeninjaconsulting.com',
  'bilal.ahmad@codeninjaconsulting.com',
  'Bilal.butt@codeninjaconsulting.com',
  'bilal.rasool@codeninjaconsulting.com',
  'danial.rashid@codeninjaconsulting.com',
  'dilawaiz@codeninjaconsulting.com',
  'eman.shahid@codeninjaconsulting.com',
  'faaiz.ahmed@codeninjaconsulting.com',
  'faiq.shamim@codeninjaconsulting.com',
  'faraz.ali@codeninjaconsulting.com',
  'finance@codeninjaconsulting.com',
  'guest1@codeninjaconsulting.com',
  'gulzaib.khan@codeninjaconsulting.com',
  'hafiz.hamza@codeninjaconsulting.com',
  'hamid.raza@codeninjaconsulting.com',
  'hamza.akhter@codeninjaconsulting.com',
  'haris.shahid@codeninjaconsulting.com',
  'haseeb.zia@codeninjaconsulting.com',
  'hassan.anwar@codeninjaconsulting.com',
  'hassan.asghar@codeninjaconsulting.com',
  'hassan.qaiser@codeninjaconsulting.com',
  'hassan.wasim@codeninjaconsulting.com',
  'huma.fayyaz@codeninjaconsulting.com',
  'humza.khan@codeninjaconsulting.com',
  'ibrar@codeninjaconsulting.com',
  'imran.ismaeel@codeninjaconsulting.com',
  'inaam.rehman@codeninjaconsulting.com',
  'itadmin@codeninjaconsulting.com',
  'jawad.ijaz@codeninjaconsulting.com',
  'junaid.alam@codeninjaconsulting.com',
  'kamran.butt@codeninjaconsulting.com',
  'kashif.abid@codeninjaconsulting.com',
  'khawar.zaki@codeninjaconsulting.com',
  'khizar.ali@codeninjaconsulting.com',
  'atteeq@codeninjaconsulting.com',
  'haseeb.zaheer@codeninjaconsulting.com',
  'mahnoor.ali@codeninjaconsulting.com',
  'mahnoor.malik@codeninjaconsulting.com',
  'majid.aslam@codeninjaconsulting.com',
  'marij.shahzad@codeninjaconsulting.com',
  'maryum.ashfaq@codeninjaconsulting.com',
  'mehmood.humayun@codeninjaconsulting.com',
  'moiz.ahmed@codeninjaconsulting.com',
  'moiz.khan@codeninjaconsulting.com',
  'mubeen@codeninjaconsulting.com',
  'Muhammad.moiz@codeninjaconsulting.com',
  'm.usman@codeninjaconsulting.com',
  'ajlal.haider@codeninjaconsulting.com',
  'muhammad.ali@codeninjaconsulting.com',
  'arsalan.tahir@codeninjaconsulting.com',
  'muhammad.ashar@codeninjaconsulting.com',
  'muhammad.atif@codeninjaconsulting.com',
  'azmat.ali@codeninjaconsulting.com',
  'muhammad.bilal@codeninjaconsulting.com',
  'm.bilal@codeninjaconsulting.com',
  'bilal.tariq@codeninjaconsulting.com',
  'muhammad.faheem@codeninjaconsulting.com',
  'muhammad.faizan@codeninjaconsulting.com',
  'faizan.gulzar@codeninjaconsulting.com',
  'muhammad.hamza@codeninjaconsulting.com',
  'haris.sikandar@codeninjaconsulting.com',
  'huzaifa.zulfiqar@codeninjaconsulting.com',
  'huzefa.abbasi@codeninjaconsulting.com',
  'muhammad.ibrahim@codeninjaconsulting.com',
  'mehboob.ahmed@codeninjaconsulting.com',
  'muhammad.mohsin@codeninjaconsulting.com',
  'Muhammad.mujahid@codeninjaconsulting.com',
  'raffay.raheel@codeninjaconsulting.com',
  'rizwan.hassan@codeninjaconsulting.com',
  'muhammad.saad@codeninjaconsulting.com',
  'm.shan@codeninjaconsulting.com',
  'sheharyar.ajmal@codeninjaconsulting.com',
  'muhammad.sohaib@codeninjaconsulting.com',
  'muhammad.taha@codeninjaconsulting.com',
  'Muhammad_talha@codeninjaconsulting.com',
  'muhammad.umer@codeninjaconsulting.com',
  'Muhammad.usama@codeninjaconsulting.com',
  'muhammad.usman@codeninjaconsulting.com',
  'usman.ikram@codeninjaconsulting.com',
  'Muhammad.waqar@codeninjaconsulting.com',
  'yaseen.khan@codeninjaconsulting.com',
  'ahmad@codeninjaconsulting.com',
  'munazza.hashmi@codeninjaconsulting.com',
  'murtaza.hussain@codeninjaconsulting.com',
  'mutahir.hashmi@codeninjaconsulting.com',
  'muzammil.bashir@codeninjaconsulting.com',
  'nadeem@codeninjaconsulting.com',
  'nasir.ali@codeninjaconsulting.com',
  'nauman.ahmad@codeninjaconsulting.com',
  'Nimra.nawaz@codeninjaconsulting.com',
  'nouman.noor@codeninjaconsulting.com',
  'owais.mabood@codeninjaconsulting.com',
  'qadir.bukhsh@codeninjaconsulting.com',
  'qazi.hamza@codeninjaconsulting.com',
  'qudrat.ullah@codeninjaconsulting.com',
  'rafia.sajid@codeninjaconsulting.com',
  'Abdul.towab@codeninjaconsulting.com',
  'Rana.waqas@codeninjaconsulting.com',
  'Rashid.abbasi@codeninjaconsulting.com',
  'resource.center@codeninjaconsulting.com',
  'saad.ameer@codeninjaconsulting.com',
  'sana.iqbal@codeninjaconsulting.com',
  'sania.abbasi@codeninjaconsulting.com',
  'shabana.shoukat@codeninjaconsulting.com',
  'shaharyar.khan@codeninjaconsulting.com',
  'shahid.hassan@codeninjaconsulting.com',
  'shiiza.khan@codeninjaconsulting.com',
  'shoaib.rauf@codeninjaconsulting.com',
  'sikandar.ramzan@codeninjaconsulting.com',
  'sikandar.sultan@codeninjaconsulting.com',
  'sikander.raheem@codeninjaconsulting.com',
  'sohail.abbasi@codeninjaconsulting.com',
  'sultan.raja@codeninjaconsulting.com',
  'sumaiya.qureshi@codeninjaconsulting.com',
  'abdullah.nasir@codeninjaconsulting.com',
  'hassan.mehmood@codeninjaconsulting.com',
  'shaji.nazar@codeninjaconsulting.com',
  'rajal.naqvi@codeninjaconsulting.com',
  'tahir.razzaq@codeninjaconsulting.com',
  'tahira@codeninjaconsulting.com',
  'Taimoor.awais@codeninjaconsulting.com',
  'taimoor.hussain@codeninjaconsulting.com',
  'taimoor.mushtaq@codeninjaconsulting.com',
  'talha.ashfaq@codeninjaconsulting.com',
  'tamur.tariq@codeninjaconsulting.com',
  'Tarab.waseem@codeninjaconsulting.com',
  'tehreem.fatima@codeninjaconsulting.com',
  'uheed.ali@codeninjaconsulting.com',
  'umar.bilal@codeninjaconsulting.com',
  'umar.khan@codeninjaconsulting.com',
  'umer.ameer@codeninjaconsulting.com',
  'umer.ayaz@codeninjaconsulting.com',
  'usama.tariq@codeninjaconsulting.com',
  'usman.javed@codeninjaconsulting.com',
  'uzaif.umer@codeninjaconsulting.com',
  'waleed.ahmad@codeninjaconsulting.com',
  'waleed.umar@codeninjaconsulting.com',
  'waqar.azam@codeninjaconsulting.com',
  'waqas.arif@codeninjaconsulting.com',
  'Yusra.sarmad@codeninjaconsulting.com',
  'zara.naeem@codeninjaconsulting.com',
  'zaroon.pasha@codeninjaconsulting.com',
  'zeeshan.ali@codeninjaconsulting.com',
  'zobaria.asma@codeninjaconsulting.com',
  'zulqarnain.haider@codeninjaconsulting.com'
];

async function checkAllEmails() {
  // Remove duplicates by converting to Set and back to Array
  const uniqueEmails = [...new Set(ALL_EMAILS.map(email => email.toLowerCase()))];
  
  console.log(`🔍 Original list: ${ALL_EMAILS.length} emails`);
  console.log(`🔍 After removing duplicates: ${uniqueEmails.length} emails`);
  console.log(`🔍 Duplicates removed: ${ALL_EMAILS.length - uniqueEmails.length}\n`);

  let found = 0;
  let notFound = 0;
  const foundEmails = [];
  const notFoundEmails = [];

  for (const email of uniqueEmails) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: {
          firstName: true,
          lastName: true,
          jobTitle: true,
          role: true,
          departmentId: true
        }
      });

      if (user) {
        const jobTitleInfo = user.jobTitle ? ` - ${user.jobTitle}` : '';
        // console.log(`✅ ${email} - EXISTS (${user.firstName} ${user.lastName}${jobTitleInfo})`);
        found++;
        foundEmails.push({
          email,
          user: `${user.firstName} ${user.lastName}`,
          jobTitle: user.jobTitle || 'Not specified'
        });
      } else {
        // console.log(`❌ ${email} - NOT FOUND`);
        notFound++;
        notFoundEmails.push(email);
      }
    } catch (error) {
      console.log(`❌ ${email} - ERROR: ${error.message}`);
      notFound++;
      notFoundEmails.push(email);
    }
  }

  console.log(`\n📊 Results: ${found} found, ${notFound} not found`);
  
  if (notFoundEmails.length > 0) {
    console.log('\n❌ Emails NOT found in database:');
    notFoundEmails.forEach((email, index) => {
      console.log(`${index + 1}. ${email}`);
    });
  }

  console.log(`\n✅ Found ${found} users in database out of ${uniqueEmails.length} unique emails`);
  
  await prisma.$disconnect();
}

checkAllEmails().catch(console.error);