import prisma from '../src/lib/prisma';
import { syncUserContacts, getUserContacts } from '../src/services/contact.service';
import { importSmsTransactions, isNonTransactionMessage, parseSmsMessage } from '../src/services/sms-filter.service';

async function main() {
  console.log('--- STARTING CONTACT & SMS SYNC VERIFICATION ---');

  // 1. Setup test users
  const testEmail1 = `test_sync_user1_${Date.now()}@example.com`;
  const testEmail2 = `test_sync_user2_${Date.now()}@example.com`;

  const user1 = await prisma.user.create({
    data: {
      name: 'User One',
      email: testEmail1,
      password: 'hashed_password_123',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: 'User Two',
      email: testEmail2,
      password: 'hashed_password_123',
    },
  });

  console.log(`Created test users: User1 (${user1.id}), User2 (${user2.id})`);

  try {
    // ── Test 1: Contact Sync with Multi-User Sources Array ────────────────────
    console.log('\n[TEST 1] Testing Contact Sync & Sources Array Tracking...');

    const sharedSuffix = String(Date.now()).slice(-8);
    const sharedPhoneNumber = `+9198${sharedSuffix}`;

    // User 1 syncs the contact
    const user1Contacts = [
      {
        name: 'Alice Friend',
        phoneNumbers: [sharedPhoneNumber],
        emails: ['alice@example.com'],
      },
      {
        name: 'Bob Unique',
        phoneNumbers: [`+9191${sharedSuffix}`],
      },
    ];

    const res1 = await syncUserContacts(user1.id, user1Contacts);
    console.log('User 1 sync result:', res1);

    const contactAfterUser1 = await prisma.contact.findUnique({
      where: { phoneNumber: sharedPhoneNumber },
    });

    if (!contactAfterUser1) throw new Error('Contact not created!');
    console.log('Contact sources after User 1 sync:', contactAfterUser1.sources);
    if (!contactAfterUser1.sources.includes(user1.id) || contactAfterUser1.sources.length !== 1) {
      throw new Error(`Expected sources to be [${user1.id}], got ${JSON.stringify(contactAfterUser1.sources)}`);
    }

    // User 2 syncs the SAME phone number (with different formatting: "+91 98...")
    const user2Contacts = [
      {
        name: 'Alice Colleague',
        phoneNumbers: [sharedPhoneNumber.replace('+91', '+91 ')],
        emails: ['alice.colleague@work.com'],
      },
      {
        name: 'Charlie Unique',
        phoneNumbers: [`+9199${sharedSuffix}`],
      },
    ];

    const res2 = await syncUserContacts(user2.id, user2Contacts);
    console.log('User 2 sync result:', res2);

    const contactAfterUser2 = await prisma.contact.findUnique({
      where: { phoneNumber: sharedPhoneNumber },
    });

    if (!contactAfterUser2) throw new Error('Contact missing!');
    console.log('Contact sources after User 2 sync:', contactAfterUser2.sources);

    if (
      contactAfterUser2.sources.length !== 2 ||
      !contactAfterUser2.sources.includes(user1.id) ||
      !contactAfterUser2.sources.includes(user2.id)
    ) {
      throw new Error(
        `Failed: Sources array must contain BOTH users! Got: ${JSON.stringify(contactAfterUser2.sources)}`,
      );
    }
    console.log('✅ Sources array successfully tracks both user IDs for shared phone number!');

    // Verify querying contacts for User 1
    const user1Query = await getUserContacts(user1.id, {});
    const aliceInUser1 = user1Query.results.find((c) => c.phoneNumber === sharedPhoneNumber);
    console.log('User 1 Alice entry:', {
      name: aliceInUser1?.name,
      phoneNumber: aliceInUser1?.phoneNumber,
      isShared: aliceInUser1?.isShared,
      sourceCount: aliceInUser1?.sourceCount,
      sources: aliceInUser1?.sources,
    });

    if (!aliceInUser1?.isShared || aliceInUser1.sourceCount !== 2) {
      throw new Error('User 1 query did not correctly flag contact as shared!');
    }
    console.log('✅ User contact query accurately reports shared status and sources array!');

    // ── Test 2: SMS Filtering (Transactions Only) ──────────────────────────────
    console.log('\n[TEST 2] Testing SMS Filtering and Transaction Extraction...');

    const sampleSmsList = [
      // 1. Legitimate Debit SMS
      {
        address: 'VK-HDFCBK',
        body: 'Rs 450.00 debited from A/C **1234 on 08-09-2026 to SWIGGY. Avl bal Rs 12,300.00',
        date: Date.now() - 3600000,
      },
      // 2. Legitimate Credit SMS (Salary)
      {
        address: 'AD-SBIINB',
        body: 'INR 35,000.00 credited to your A/C **5678 as SALARY for August on 01-09-2026. Avl Bal INR 45,000.',
        date: Date.now() - 7200000,
      },
      // 3. Legitimate UPI Transfer SMS
      {
        address: 'VM-SBIPAY',
        body: 'Sent Rs 1,500.00 to friend@okhdfcbank via UPI ref 425619283719 on 05-09-2026.',
        date: Date.now() - 10800000,
      },
      // 4. Non-transaction: Authorization OTP
      {
        address: 'VK-HDFCBK',
        body: '394812 is your OTP for txn of Rs 500 at Amazon on card ending 1234. Valid for 10 mins. Do NOT share.',
        date: Date.now() - 1800000,
      },
      // 5. Non-transaction: Promotional Offer
      {
        address: 'BAJAJF',
        body: 'Congratulations! You are pre-approved for personal loan of Rs 5 Lakhs with zero processing fee. Click to apply.',
        date: Date.now() - 86400000,
      },
      // 6. Non-transaction: Telecom alert
      {
        address: 'JIOINF',
        body: 'Your daily high speed data pack of 1.5GB is 90% exhausted. Recharge now with Rs 19.',
        date: Date.now() - 43200000,
      },
    ];

    // Check individual message classifications
    console.log('Checking individual filter classifications:');
    console.log('Debit SMS non-transaction?', isNonTransactionMessage(sampleSmsList[0].body));
    console.log('Credit SMS non-transaction?', isNonTransactionMessage(sampleSmsList[1].body));
    console.log('OTP SMS non-transaction?', isNonTransactionMessage(sampleSmsList[3].body));
    console.log('Promo SMS non-transaction?', isNonTransactionMessage(sampleSmsList[4].body));
    console.log('Telecom SMS non-transaction?', isNonTransactionMessage(sampleSmsList[5].body));

    if (
      !isNonTransactionMessage(sampleSmsList[3].body) ||
      !isNonTransactionMessage(sampleSmsList[4].body) ||
      !isNonTransactionMessage(sampleSmsList[5].body)
    ) {
      throw new Error('Filter failed to identify non-transaction SMS!');
    }

    // Now import via importSmsTransactions
    const smsImportSummary = await importSmsTransactions(user1.id, sampleSmsList, 'INR');
    console.log('SMS Import Summary:', smsImportSummary);

    if (smsImportSummary.transactionsDetected !== 3 || smsImportSummary.inserted !== 3) {
      throw new Error(
        `Expected 3 transactions detected and inserted, got detected: ${smsImportSummary.transactionsDetected}, inserted: ${smsImportSummary.inserted}`,
      );
    }

    if (smsImportSummary.skippedNonTransactions !== 3) {
      throw new Error(
        `Expected 3 non-transaction SMS skipped, got: ${smsImportSummary.skippedNonTransactions}`,
      );
    }
    console.log('✅ Exactly 3 financial transactions imported; OTP, promo, and telecom alerts skipped!');

    // Check inserted transactions in DB
    const savedTransactions = await prisma.transaction.findMany({
      where: { userId: user1.id, source: 'SMS' },
      orderBy: { date: 'desc' },
    });

    console.log(
      'Saved transactions in DB:',
      savedTransactions.map((t) => ({
        id: t.id,
        title: t.title,
        amount: Number(t.amount),
        direction: t.direction,
        category: t.category,
        source: t.source,
      })),
    );

    if (savedTransactions.length !== 3) {
      throw new Error(`Expected 3 DB records, found ${savedTransactions.length}`);
    }

    // ── Test 3: Deduplication ─────────────────────────────────────────────────
    console.log('\n[TEST 3] Testing Idempotent Re-Import (Deduplication)...');
    const repeatImportSummary = await importSmsTransactions(user1.id, sampleSmsList, 'INR');
    console.log('Repeat SMS Import Summary:', repeatImportSummary);

    if (repeatImportSummary.inserted !== 0 || repeatImportSummary.duplicates !== 3) {
      throw new Error(
        `Expected 0 inserted and 3 duplicates on repeat import, got inserted: ${repeatImportSummary.inserted}, duplicates: ${repeatImportSummary.duplicates}`,
      );
    }
    console.log('✅ Deduplication verified: Re-syncing SMS inbox does not duplicate transactions!');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Cleanup test data
    console.log('\nCleaning up test data...');
    await prisma.transaction.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
    await prisma.userContact.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
    await prisma.contact.deleteMany({
      where: {
        OR: [
          { phoneNumber: { startsWith: '+9198' } },
          { phoneNumber: { startsWith: '+9191' } },
          { phoneNumber: { startsWith: '+9199' } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
    console.log('Cleanup completed.');
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
