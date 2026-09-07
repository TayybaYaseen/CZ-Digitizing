-- CreateEnum
CREATE TYPE "TaeboSender" AS ENUM ('customer', 'taebo', 'admin');

-- CreateEnum
CREATE TYPE "TaeboWaitingStatus" AS ENUM ('waiting', 'answered');

-- CreateTable
CREATE TABLE "taebo_conversations" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT,
    "session_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taebo_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taebo_messages" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "sender" "TaeboSender" NOT NULL,
    "message" TEXT NOT NULL,
    "matched_faq_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taebo_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taebo_waiting_questions" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "question_text" TEXT NOT NULL,
    "status" "TaeboWaitingStatus" NOT NULL DEFAULT 'waiting',
    "admin_answer" TEXT,
    "answered_by_admin_id" BIGINT,
    "saved_as_faq_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),

    CONSTRAINT "taebo_waiting_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_taebo_conversations_customer" ON "taebo_conversations"("customer_id");

-- CreateIndex
CREATE INDEX "idx_taebo_conversations_session" ON "taebo_conversations"("session_id");

-- CreateIndex
CREATE INDEX "idx_taebo_messages_conversation" ON "taebo_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_taebo_waiting_questions_conversation" ON "taebo_waiting_questions"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_taebo_waiting_questions_status" ON "taebo_waiting_questions"("status");

-- AddForeignKey
ALTER TABLE "taebo_conversations" ADD CONSTRAINT "taebo_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taebo_messages" ADD CONSTRAINT "taebo_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "taebo_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taebo_messages" ADD CONSTRAINT "taebo_messages_matched_faq_id_fkey" FOREIGN KEY ("matched_faq_id") REFERENCES "faqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taebo_waiting_questions" ADD CONSTRAINT "taebo_waiting_questions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "taebo_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taebo_waiting_questions" ADD CONSTRAINT "taebo_waiting_questions_answered_by_admin_id_fkey" FOREIGN KEY ("answered_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taebo_waiting_questions" ADD CONSTRAINT "taebo_waiting_questions_saved_as_faq_id_fkey" FOREIGN KEY ("saved_as_faq_id") REFERENCES "faqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
