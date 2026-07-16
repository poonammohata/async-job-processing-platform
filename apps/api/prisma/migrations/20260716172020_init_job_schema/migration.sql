-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('EMAIL', 'SMS', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobAttemptStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'STALLED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "delayMs" INTEGER,
    "runAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "JobAttemptStatus" NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_priority_createdAt_idx" ON "Job"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "Job_type_createdAt_idx" ON "Job"("type", "createdAt");

-- CreateIndex
CREATE INDEX "JobAttempt_jobId_idx" ON "JobAttempt"("jobId");

-- CreateIndex
CREATE INDEX "JobAttempt_status_idx" ON "JobAttempt"("status");

-- CreateIndex
CREATE INDEX "JobAttempt_jobId_status_idx" ON "JobAttempt"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobAttempt_jobId_attemptNumber_key" ON "JobAttempt"("jobId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "JobAttempt" ADD CONSTRAINT "JobAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
