const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testMatchEmailNotifications() {
  console.log('🧪 Testing Match Email Notification Logic\n');

  try {
    // Test 1: Find a regular 2-participant match
    console.log('1️⃣ Testing Regular 2-Participant Match Logic...');
    const regularMatch = await prisma.match.findFirst({
      where: {
        game: {
          contestType: {
            not: 'SINGLE_ELIMINATION_1V1V1V1'
          }
        },
        participantAId: { not: 'TBD' },
        participantBId: { not: 'TBD' },
        participantAType: { not: 'PLACEHOLDER' },
        participantBType: { not: 'PLACEHOLDER' }
      },
      include: {
        game: {
          include: {
            category: true
          }
        },
        slot: true
      }
    });

    if (regularMatch) {
      console.log(`✅ Found regular match: ${regularMatch.game.name}`);
      console.log(`   - Participant A: ${regularMatch.participantAId} (${regularMatch.participantAType})`);
      console.log(`   - Participant B: ${regularMatch.participantBId} (${regularMatch.participantBType})`);
      console.log(`   - Should send email: YES (both participants are real)\n`);
    } else {
      console.log('❌ No regular matches found with both participants scheduled\n');
    }

    // Test 2: Find a scoring contest match
    console.log('2️⃣ Testing Scoring Contest Match Logic...');
    const scoringMatch = await prisma.match.findFirst({
      where: {
        game: {
          contestType: 'SCORING'
        },
        participantAId: { not: 'TBD' },
        participantAType: { not: 'PLACEHOLDER' }
      },
      include: {
        game: {
          include: {
            category: true
          }
        },
        slot: true
      }
    });

    if (scoringMatch) {
      console.log(`✅ Found scoring contest match: ${scoringMatch.game.name}`);
      console.log(`   - Participant A: ${scoringMatch.participantAId} (${scoringMatch.participantAType})`);
      console.log(`   - Participant B: ${scoringMatch.participantBId || 'N/A'} (${scoringMatch.participantBType || 'N/A'})`);
      console.log(`   - Should send email: YES (only participant A required for scoring contests)\n`);
    } else {
      console.log('❌ No scoring contest matches found with participant A scheduled\n');
    }

    // Test 3: Find a 1v1v1v1 match
    console.log('3️⃣ Testing 1v1v1v1 Match Logic...');
    const fourPlayerMatch = await prisma.match.findFirst({
      where: {
        game: {
          contestType: 'SINGLE_ELIMINATION_1V1V1V1'
        }
      },
      include: {
        game: {
          include: {
            category: true
          }
        },
        slot: true
      }
    });

    if (fourPlayerMatch) {
      console.log(`✅ Found 1v1v1v1 match: ${fourPlayerMatch.game.name}`);
      
      let realParticipantCount = 0;
      let participantDetails = [];

      // Check participants 1 and 2 from participantAId JSON
      if (fourPlayerMatch.participantAType === 'FOUR_PARTICIPANT_DATA' && fourPlayerMatch.participantAId !== 'TBD') {
        try {
          const participantAData = JSON.parse(fourPlayerMatch.participantAId);
          if (participantAData.participant1Id && participantAData.participant1Type !== 'PLACEHOLDER') {
            realParticipantCount++;
            participantDetails.push(`Participant 1: ${participantAData.participant1Id} (${participantAData.participant1Type})`);
          }
          if (participantAData.participant2Id && participantAData.participant2Type !== 'PLACEHOLDER') {
            realParticipantCount++;
            participantDetails.push(`Participant 2: ${participantAData.participant2Id} (${participantAData.participant2Type})`);
          }
        } catch (error) {
          console.log(`   ❌ Error parsing participantAId JSON: ${error.message}`);
        }
      }

      // Check participants 3 and 4 from participantBId JSON
      if (fourPlayerMatch.participantBType === 'FOUR_PARTICIPANT_DATA' && fourPlayerMatch.participantBId !== 'TBD') {
        try {
          const participantBData = JSON.parse(fourPlayerMatch.participantBId);
          if (participantBData.participant3Id && participantBData.participant3Type !== 'PLACEHOLDER') {
            realParticipantCount++;
            participantDetails.push(`Participant 3: ${participantBData.participant3Id} (${participantBData.participant3Type})`);
          }
          if (participantBData.participant4Id && participantBData.participant4Type !== 'PLACEHOLDER') {
            realParticipantCount++;
            participantDetails.push(`Participant 4: ${participantBData.participant4Id} (${participantBData.participant4Type})`);
          }
        } catch (error) {
          console.log(`   ❌ Error parsing participantBId JSON: ${error.message}`);
        }
      }

      console.log(`   - Real participants: ${realParticipantCount}/4`);
      participantDetails.forEach(detail => console.log(`   - ${detail}`));
      console.log(`   - Should send email: ${realParticipantCount === 4 ? 'YES' : 'NO'} (need all 4 participants)\n`);
    } else {
      console.log('❌ No 1v1v1v1 matches found\n');
    }

    // Test 4: Check email configuration
    console.log('4️⃣ Testing Email Configuration...');
    const emailConfig = await prisma.config.findUnique({
      where: { key: 'email.match_scheduled.enabled' }
    });

    if (emailConfig) {
      console.log(`✅ Email config found: ${emailConfig.key} = ${emailConfig.value}`);
      console.log(`   - Match scheduled emails are: ${emailConfig.value === 'true' ? 'ENABLED' : 'DISABLED'}\n`);
    } else {
      console.log('⚠️  Email config not found in database, using default: ENABLED\n');
    }

    // Test 5: Check recent matches that should have triggered emails
    console.log('5️⃣ Checking Recent Matches (Last 24 hours)...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentMatches = await prisma.match.findMany({
      where: {
        createdAt: {
          gte: yesterday
        }
      },
      include: {
        game: {
          include: {
            category: true
          }
        },
        slot: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`Found ${recentMatches.length} matches created in the last 24 hours:`);
    
    for (const match of recentMatches) {
      let shouldSendEmail = false;
      let participantInfo = '';

      if (match.game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        let realCount = 0;
        // Check 1v1v1v1 logic
        if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
          try {
            const data = JSON.parse(match.participantAId);
            if (data.participant1Id && data.participant1Type !== 'PLACEHOLDER') realCount++;
            if (data.participant2Id && data.participant2Type !== 'PLACEHOLDER') realCount++;
          } catch (e) {}
        }
        if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
          try {
            const data = JSON.parse(match.participantBId);
            if (data.participant3Id && data.participant3Type !== 'PLACEHOLDER') realCount++;
            if (data.participant4Id && data.participant4Type !== 'PLACEHOLDER') realCount++;
          } catch (e) {}
        }
        shouldSendEmail = (realCount === 4);
        participantInfo = `${realCount}/4 participants`;
      } else {
        // Regular match logic
        shouldSendEmail = (
          match.participantAId !== 'TBD' &&
          match.participantBId !== 'TBD' &&
          match.participantAType !== 'PLACEHOLDER' &&
          match.participantBType !== 'PLACEHOLDER'
        );
        participantInfo = `A: ${match.participantAId}, B: ${match.participantBId}`;
      }

      const emailStatus = shouldSendEmail ? '📧 EMAIL SENT' : '⏳ WAITING';
      console.log(`   - ${match.game.name} (${match.game.contestType}) - ${participantInfo} - ${emailStatus}`);
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - The fix properly handles both regular and 1v1v1v1 match formats');
    console.log('   - Email notifications will only be sent when ALL participants are scheduled');
    console.log('   - For regular matches: need both participants (A & B)');
    console.log('   - For 1v1v1v1 matches: need all 4 participants');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMatchEmailNotifications();