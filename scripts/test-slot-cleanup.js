/**
 * Test script to verify slot cleanup functionality
 * This script simulates the slot cleanup process
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSlotCleanup() {
  console.log('🧪 Testing slot cleanup functionality...\n');

  try {
    // Get all games to test with
    const games = await prisma.game.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            slots: true,
            matches: true
          }
        }
      }
    });

    console.log(`Found ${games.length} games to analyze:\n`);

    for (const game of games) {
      console.log(`📊 Game: ${game.name} (ID: ${game.id})`);
      console.log(`   Slots: ${game._count.slots}, Matches: ${game._count.matches}`);

      // Get detailed slot information
      const slots = await prisma.slot.findMany({
        where: { gameId: game.id },
        include: {
          matches: true
        }
      });

      const unusedSlots = slots.filter(slot => slot.matches.length === 0);
      const usedSlots = slots.filter(slot => slot.matches.length > 0);

      console.log(`   Used slots: ${usedSlots.length}`);
      console.log(`   Unused slots: ${unusedSlots.length}`);

      if (unusedSlots.length > 0) {
        console.log('   🗑️  Unused slots found:');
        unusedSlots.forEach(slot => {
          console.log(`      - Slot ${slot.id}: ${slot.startTime} - ${slot.endTime} (Timeline ${slot.timelineId})`);
        });
      }

      console.log('');
    }

    // Test the validation logic
    console.log('🔍 Testing validation logic...\n');

    // Find games with both matches and slots
    const gamesWithData = await prisma.game.findMany({
      where: {
        AND: [
          { slots: { some: {} } },
          { matches: { some: {} } }
        ]
      },
      include: {
        slots: true,
        matches: {
          include: {
            slot: true
          }
        },
        category: {
          select: {
            startDate: true,
            endDate: true,
            dailyWindows: true
          }
        }
      }
    });

    for (const game of gamesWithData) {
      console.log(`🎯 Analyzing game: ${game.name}`);
      
      // Parse daily windows
      const dailyWindows = JSON.parse(game.category.dailyWindows || '[]');
      console.log(`   Daily windows: ${dailyWindows.length}`);

      // Check for invalid matches (outside time windows)
      let invalidMatches = 0;
      let validMatches = 0;

      for (const match of game.matches) {
        if (match.slot) {
          const slotStart = new Date(match.slot.startTime);
          const slotEnd = new Date(match.slot.endTime);
          
          // Validate if match is within valid date range
          const matchDate = slotStart.toDateString();
          const gameStartDate = new Date(game.category.startDate).toDateString();
          const gameEndDate = new Date(game.category.endDate).toDateString();
          
          const isValidDate = matchDate >= gameStartDate && matchDate <= gameEndDate;
          
          // Validate if match is within valid time windows
          const matchStartTime = slotStart.toTimeString().slice(0, 5); // HH:MM format
          const matchEndTime = slotEnd.toTimeString().slice(0, 5); // HH:MM format
          const isValidTimeWindow = dailyWindows.some(window =>
            window.start <= matchStartTime && matchEndTime <= window.end
          );

          if (!isValidDate || !isValidTimeWindow) {
            invalidMatches++;
            console.log(`   ❌ Invalid match: ${match.id} (${matchStartTime}-${matchEndTime})`);
          } else {
            validMatches++;
          }
        }
      }

      console.log(`   Valid matches: ${validMatches}`);
      console.log(`   Invalid matches: ${invalidMatches}`);

      // Check for unused slots
      const unusedSlots = game.slots.filter(slot => 
        !game.matches.some(match => match.slotId === slot.id)
      );

      console.log(`   Unused slots: ${unusedSlots.length}`);
      
      if (unusedSlots.length > 0) {
        console.log('   🗑️  Would clean up unused slots:');
        unusedSlots.forEach(slot => {
          console.log(`      - ${slot.id}: ${slot.startTime} - ${slot.endTime}`);
        });
      }

      console.log('');
    }

    console.log('✅ Slot cleanup test completed successfully!');

  } catch (error) {
    console.error('❌ Error during slot cleanup test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSlotCleanup();