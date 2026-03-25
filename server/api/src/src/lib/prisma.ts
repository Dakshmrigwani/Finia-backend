import { env } from '@/config';
import paginate from '@/utils/paginate';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const connectionString = `${env.db.url}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }).$extends({
  model: {
    $allModels: {
      paginate,
    },
  },
});

export default prisma;
