-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "related_contact_message_id" BIGINT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_contact_message_id_fkey" FOREIGN KEY ("related_contact_message_id") REFERENCES "contact_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
