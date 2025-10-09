/*
  Warnings:

  - You are about to drop the column `recipientsCount` on the `email_logs` table. All the data in the column will be lost.
  - You are about to drop the column `segment` on the `email_logs` table. All the data in the column will be lost.
  - You are about to drop the column `templateId` on the `email_logs` table. All the data in the column will be lost.
  - You are about to drop the `email_templates` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `recipient` to the `email_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subject` to the `email_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "email_logs" DROP CONSTRAINT "email_logs_templateId_fkey";

-- AlterTable
ALTER TABLE "email_logs" DROP COLUMN "recipientsCount",
DROP COLUMN "segment",
DROP COLUMN "templateId",
ADD COLUMN     "recipient" TEXT NOT NULL,
ADD COLUMN     "subject" TEXT NOT NULL,
ALTER COLUMN "sentBy" DROP NOT NULL;

-- DropTable
DROP TABLE "email_templates";

-- CreateTable
CREATE TABLE "game_reminders" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_reminders_gameId_slotId_reminderType_key" ON "game_reminders"("gameId", "slotId", "reminderType");

-- AddForeignKey
ALTER TABLE "game_reminders" ADD CONSTRAINT "game_reminders_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_reminders" ADD CONSTRAINT "game_reminders_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
