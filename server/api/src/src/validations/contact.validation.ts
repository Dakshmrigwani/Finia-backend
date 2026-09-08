import { strictZod as z } from '@/utils/strict-zod';

const phoneNumberSchema = z.union([
  z.string(),
  z.object({
    number: z.string().optional(),
    digits: z.string().optional(),
    label: z.string().optional(),
  }),
]);

const emailSchema = z.union([
  z.string(),
  z.object({
    email: z.string().optional(),
    label: z.string().optional(),
  }),
]);

const contactItemSchema = z.object({
  name: z.string(),
  phoneNumbers: z.array(phoneNumberSchema).optional(),
  emails: z.array(emailSchema).optional(),
});

const syncContacts = {
  body: z.object({
    contacts: z.array(contactItemSchema).min(1, 'At least one contact is required to sync'),
  }),
};

const getContacts = {
  query: z.object({
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
  }),
};

export default {
  syncContacts,
  getContacts,
};
