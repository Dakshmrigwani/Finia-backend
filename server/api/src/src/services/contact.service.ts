import prisma from '@/lib/prisma';
import { logger } from '@/config/logger';

export type RawPhoneNumber = string | { number?: string; digits?: string; label?: string };
export type RawEmail = string | { email?: string; label?: string };

export interface ContactSyncItem {
  name: string;
  phoneNumbers?: RawPhoneNumber[];
  emails?: RawEmail[];
}

export interface ContactSyncResult {
  totalReceived: number;
  contactsProcessed: number;
  newContactsCreated: number;
  sharedContactsFound: number;
}

export interface GetContactsQuery {
  search?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
}

/**
 * Normalizes a phone number to a standard format (+countryCode and digits).
 * Handles Indian numbers, international numbers, and removes noise formatting.
 */
export const normalizePhoneNumber = (raw: string): string | null => {
  if (!raw || typeof raw !== 'string') return null;

  // Remove whitespace, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-().]/g, '');

  if (cleaned.length < 6) return null;

  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  // Handle standard 10-digit Indian numbers without country code
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Handle leading 0 (e.g. 09876543210 -> +919876543210)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  // Handle 12-digit Indian numbers starting with 91 without +
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // General international format: must start with + followed by 7 to 15 digits
  if (/^\+\d{7,15}$/.test(cleaned)) {
    return cleaned;
  }

  // If only digits without +, but between 7 and 15 digits
  if (/^\d{7,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
};

const extractPhoneNumbers = (items?: RawPhoneNumber[]): string[] => {
  if (!Array.isArray(items)) return [];
  const numbers: string[] = [];

  for (const item of items) {
    let raw = '';
    if (typeof item === 'string') {
      raw = item;
    } else if (item && typeof item === 'object') {
      raw = item.number || item.digits || '';
    }

    const normalized = normalizePhoneNumber(raw);
    if (normalized && !numbers.includes(normalized)) {
      numbers.push(normalized);
    }
  }

  return numbers;
};

const extractEmails = (items?: RawEmail[]): string[] => {
  if (!Array.isArray(items)) return [];
  const emails: string[] = [];

  for (const item of items) {
    let email = '';
    if (typeof item === 'string') {
      email = item.trim().toLowerCase();
    } else if (item && typeof item === 'object' && item.email) {
      email = item.email.trim().toLowerCase();
    }

    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !emails.includes(email)) {
      emails.push(email);
    }
  }

  return emails;
};

// ─── Contact Sync Service ─────────────────────────────────────────────────────

/**
 * Sync user contacts from Expo client.
 *
 * For every contact:
 * 1. Checks if a global `Contact` record already exists for each normalized phone number.
 * 2. If it exists:
 *    - Appends the current `userId` into the `sources` array if not already present.
 * 3. If it does not exist:
 *    - Creates the `Contact` with `sources: [userId]`.
 * 4. Upserts the `UserContact` record so the user has their personal contact book saved.
 */
export const syncUserContacts = async (
  userId: string,
  contactItems: ContactSyncItem[],
): Promise<ContactSyncResult> => {
  let contactsProcessed = 0;
  let newContactsCreated = 0;
  let sharedContactsFound = 0;

  for (const item of contactItems) {
    const name = (item.name || '').trim() || 'Unknown Contact';
    const phoneNumbers = extractPhoneNumbers(item.phoneNumbers);
    const emails = extractEmails(item.emails);

    if (phoneNumbers.length === 0) {
      continue;
    }

    for (const phoneNumber of phoneNumbers) {
      // Step 1: Find existing global Contact
      let contact = await prisma.contact.findUnique({
        where: { phoneNumber },
      });

      if (!contact) {
        // Create new Contact with current user as initial source
        contact = await prisma.contact.create({
          data: {
            phoneNumber,
            name,
            sources: [userId],
          },
        });
        newContactsCreated++;
      } else {
        // Contact exists in the system
        const hasUserAsSource = contact.sources.includes(userId);
        const updatedSources = hasUserAsSource
          ? contact.sources
          : [...contact.sources, userId];

        if (!hasUserAsSource) {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: {
              sources: updatedSources,
              name: contact.name || name,
            },
          });
        }

        // If multiple users know this contact, record it as shared
        if (contact.sources.length > 1) {
          sharedContactsFound++;
        }
      }

      // Step 2: Upsert user's private UserContact book
      await prisma.userContact.upsert({
        where: {
          userId_phoneNumber: {
            userId,
            phoneNumber,
          },
        },
        create: {
          userId,
          contactId: contact.id,
          name,
          phoneNumber,
          emails,
        },
        update: {
          name,
          emails,
          contactId: contact.id,
        },
      });

      contactsProcessed++;
    }
  }

  logger.info(
    'Contact sync for user %s: %d processed, %d new global, %d shared across users',
    userId,
    contactsProcessed,
    newContactsCreated,
    sharedContactsFound,
  );

  return {
    totalReceived: contactItems.length,
    contactsProcessed,
    newContactsCreated,
    sharedContactsFound,
  };
};

// ─── Query User Contacts ──────────────────────────────────────────────────────

export const getUserContacts = async (userId: string, query: GetContactsQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const whereClause: {
    userId: string;
    OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; phoneNumber?: { contains: string; mode: 'insensitive' } }>;
  } = {
    userId,
  };

  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    whereClause.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { phoneNumber: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [totalResults, records] = await Promise.all([
    prisma.userContact.count({ where: whereClause }),
    prisma.userContact.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        contact: {
          select: {
            sources: true,
          },
        },
      },
    }),
  ]);

  const results = records.map((record) => {
    const sources = record.contact?.sources ?? [];
    return {
      id: record.id,
      name: record.name,
      phoneNumber: record.phoneNumber,
      emails: record.emails,
      contactId: record.contactId,
      sources,
      isShared: sources.length > 1,
      sourceCount: sources.length,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  });

  return {
    results,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};
