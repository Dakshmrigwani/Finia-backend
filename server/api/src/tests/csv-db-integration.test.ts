import assert from 'node:assert';
import prisma from '../src/lib/prisma';
import { importCsvStatement } from '../src/import/service';

async function runEndToEndTests() {
  console.log('Running End-to-End Database Integration Tests for CSV Import...\n');

  try {
    // 1. Setup two test users
    const testEmail1 = `csvtest_${Date.now()}_1@example.com`;
    const testEmail2 = `csvtest_${Date.now()}_2@example.com`;

    const user1 = await prisma.user.create({
      data: {
        name: 'CSV Test User 1',
        email: testEmail1,
        password: 'hashedpassword123',
      },
    });

    const user2 = await prisma.user.create({
      data: {
        name: 'CSV Test User 2',
        email: testEmail2,
        password: 'hashedpassword123',
      },
    });

    console.log(`Created test users: ${user1.id} and ${user2.id}`);

    // 2. Generate a sample CSV with ~50 rows
    const rows = ['Date,Description,Amount'];
    for (let i = 1; i <= 50; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      const isExpense = i % 2 === 0;
      const amt = (i * 10.5).toFixed(2);
      const sign = isExpense ? '-' : '';
      rows.push(`2026-09-${day},Merchant Store #${i},${sign}${amt}`);
    }
    const sampleCsv = Buffer.from(rows.join('\n'));

    // 3. First Upload for User 1
    console.log('Test 1: First upload of 50-row CSV for User 1...');
    const result1 = await importCsvStatement(user1.id, sampleCsv);
    assert.strictEqual(result1.imported, 50, 'All 50 rows should be imported');
    assert.strictEqual(result1.skipped, 0, 'Zero rows should be skipped on first upload');
    assert.strictEqual(result1.failed.length, 0, 'Zero rows should fail');
    assert.ok(result1.dateRange, 'dateRange should be present');
    assert.strictEqual(result1.dateRange?.from, '2026-09-01');
    assert.strictEqual(result1.dateRange?.to, '2026-09-28');

    const countAfterFirst = await prisma.transaction.count({
      where: { userId: user1.id },
    });
    assert.strictEqual(countAfterFirst, 50, 'DB transaction count should be 50');
    console.log('  ✓ 50 rows imported successfully with positive amounts and valid date ranges');

    // Verify properties of imported rows in DB
    const sampleTx = await prisma.transaction.findFirst({
      where: { userId: user1.id, title: 'Merchant Store #2' },
    });
    assert.ok(sampleTx);
    assert.strictEqual(Number(sampleTx.amount), 21.0); // positive!
    assert.strictEqual(sampleTx.direction, 'EXPENSE'); // -21.00 -> EXPENSE
    assert.strictEqual(sampleTx.source, 'CSV');
    assert.strictEqual(sampleTx.category, 'OTHER');
    assert.strictEqual(sampleTx.type, 'VARIABLE');
    console.log('  ✓ Verified stored DB row: amount positive, direction EXPENSE, source CSV, category OTHER');

    // 4. Second Upload of exact same CSV for User 1 (Idempotency test)
    console.log('Test 2: Re-uploading identical CSV for User 1 (Idempotency check)...');
    const result2 = await importCsvStatement(user1.id, sampleCsv);
    assert.strictEqual(result2.imported, 0, 'Zero rows should be imported on re-upload');
    assert.strictEqual(result2.skipped, 50, 'All 50 rows should be skipped as duplicates');
    assert.strictEqual(result2.failed.length, 0);

    const countAfterSecond = await prisma.transaction.count({
      where: { userId: user1.id },
    });
    assert.strictEqual(countAfterSecond, 50, 'DB transaction count must remain unchanged at 50');
    console.log('  ✓ Re-upload returned imported = 0, skipped = 50, DB row count unchanged');

    // 5. Upload identical CSV for User 2 (Cross-user isolation test)
    console.log('Test 3: Upload identical CSV for User 2 (Cross-user isolation check)...');
    const resultUser2 = await importCsvStatement(user2.id, sampleCsv);
    assert.strictEqual(resultUser2.imported, 50, 'All 50 rows should be imported for User 2 without collision');
    assert.strictEqual(resultUser2.skipped, 0);

    const countUser2 = await prisma.transaction.count({
      where: { userId: user2.id },
    });
    assert.strictEqual(countUser2, 50, 'User 2 DB transaction count should be 50');
    console.log('  ✓ Cross-user isolation verified: identical content does NOT collide between different users');

    // Cleanup
    await prisma.transaction.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
    console.log('  ✓ Cleaned up test database fixtures');

    console.log('\n🎉 ALL DATABASE INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    await prisma.$disconnect();
  }
}

runEndToEndTests().catch((err) => {
  console.error('\n❌ End-to-End Database Integration Test Failed:', err);
  process.exit(1);
});
