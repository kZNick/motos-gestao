CREATE TABLE "StoredImage" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoredImage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoredImage_unitId_hash_key" ON "StoredImage"("unitId", "hash");
