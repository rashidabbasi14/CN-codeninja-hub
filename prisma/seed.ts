import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting ultra-minimal production database seed...')

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'rashidabbasi17@gmail.com' },
    update: {},
    create: {
      email: 'rashidabbasi17@gmail.com',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ADMIN',
      gender: 'MALE',
      age: 28,
      phone: '+92-331-3817104',
      privacyHideAge: false,
      privacyHideGender: false
    }
  })

  console.log(`✅ Created admin user: ${adminUser.email}`)

  // Create basic welcome news article
  const news = await Promise.all([
    prisma.news.create({
      data: {
        title: 'Welcome to CodeNinja Sports Platform!',
        body: 'Welcome to our sports management platform! This system allows you to organize and participate in various sports events and competitions. Administrators can create events, manage registrations, and track results. Stay tuned for upcoming announcements about sports events and activities.',
        createdBy: adminUser.id,
        isPinned: true
      }
    })
  ])

  console.log(`✅ Created ${news.length} news articles`)

  console.log('🎉 Ultra-minimal production database seed completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`- Admin User: 1`)
  console.log(`- News Articles: ${news.length}`)
  console.log('\n🚀 System is ready for production use!')
  console.log('Administrator can now create departments, events, and manage the platform.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })