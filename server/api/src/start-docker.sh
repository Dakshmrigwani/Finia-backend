#!/bin/sh

echo "Applying migrations!"
npx prisma migrate deploy

echo "Starting the app!"
exec pnpm start
