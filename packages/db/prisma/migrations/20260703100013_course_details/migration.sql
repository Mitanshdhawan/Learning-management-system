-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'all_levels');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'English',
ADD COLUMN     "learning_outcomes" TEXT[],
ADD COLUMN     "level" "CourseLevel" NOT NULL DEFAULT 'all_levels',
ADD COLUMN     "preview_video_id" UUID,
ADD COLUMN     "requirements" TEXT[],
ADD COLUMN     "subtitle" TEXT;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_preview_video_id_fkey" FOREIGN KEY ("preview_video_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
