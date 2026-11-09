-- G04: additive, durable attention history and optimistic concurrency.
ALTER TABLE "AttentionItem" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PortfolioAttentionEvent" (
    "id" TEXT NOT NULL,
    "attentionItemId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeStatus" "AttentionItemStatus",
    "afterStatus" "AttentionItemStatus" NOT NULL,
    "previousOwnerId" TEXT,
    "nextOwnerId" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioAttentionEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortfolioAttentionEvent_idempotencyKey_key" ON "PortfolioAttentionEvent"("idempotencyKey");
CREATE INDEX "PortfolioAttentionEvent_attentionItemId_createdAt_idx" ON "PortfolioAttentionEvent"("attentionItemId", "createdAt");
CREATE INDEX "PortfolioAttentionEvent_actorId_idx" ON "PortfolioAttentionEvent"("actorId");
ALTER TABLE "PortfolioAttentionEvent" ADD CONSTRAINT "PortfolioAttentionEvent_attentionItemId_fkey"
  FOREIGN KEY ("attentionItemId") REFERENCES "AttentionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
