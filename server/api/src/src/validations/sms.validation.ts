import { strictZod as z } from '@/utils/strict-zod';

const smsMessageSchema = z.object({
  id: z.string().optional(),
  address: z.string().optional(),
  body: z.string().min(1, 'SMS body is required'),
  date: z.union([z.number(), z.string()]).optional(),
});

const syncSms = {
  body: z.object({
    messages: z.array(smsMessageSchema).min(1, 'At least one message is required to import'),
  }),
};

export default {
  syncSms,
};
