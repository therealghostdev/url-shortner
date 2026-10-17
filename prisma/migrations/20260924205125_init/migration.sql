-- CreateTable
CREATE TABLE "Urls" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Urls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Urls_code_key" ON "Urls"("code");
