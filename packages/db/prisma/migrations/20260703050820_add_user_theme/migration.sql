-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'light';
