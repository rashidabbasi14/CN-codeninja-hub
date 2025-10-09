/*
  Warnings:

  - You are about to drop the `assignments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_slotId_fkey";

-- DropTable
DROP TABLE "assignments";
