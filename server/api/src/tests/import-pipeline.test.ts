import assert from 'node:assert';
import { parseTransactionsFromText } from '../src/services/transaction-parser.service';
import { normalizeTransactions, extractCurrencyCode } from '../src/services/transaction-normalizer.service';
import { categorizeTransaction } from '../src/services/transaction-categorizer.service';
import { generateFingerprint } from '../src/services/transaction-deduplication.service';

async function runTests() {
  console.log('Running Finia PDF Transaction Import Pipeline Tests...\n');

  // ─── Test 1: Parser — Generic Tabular Format ───────────────────
  console.log('Test 1: Parsing columnar statement text...');
  const sampleText = `
Account Statement
Date        Description             Debit       Credit
01/09/2026  Swiggy                  450.00
02/09/2026  Amazon Retail           1200.50
03/09/2026  Salary Credit                       50000.00
04/09/2026  Uber Trip               250.00
Closing Balance: 48100.00
  `;

  const parseResult = parseTransactionsFromText(sampleText);
  assert.strictEqual(parseResult.parsed.length, 4, 'Should parse 4 transaction rows');
  
  // Row 1: Swiggy
  assert.strictEqual(parseResult.parsed[0].date, '2026-09-01');
  assert.ok(parseResult.parsed[0].description.includes('Swiggy'));
  assert.strictEqual(parseResult.parsed[0].amount, 450);
  assert.strictEqual(parseResult.parsed[0].type, 'DEBIT');

  // Row 3: Salary
  assert.strictEqual(parseResult.parsed[2].date, '2026-09-03');
  assert.ok(parseResult.parsed[2].description.includes('Salary'));
  assert.strictEqual(parseResult.parsed[2].amount, 50000);
  assert.strictEqual(parseResult.parsed[2].type, 'CREDIT');
  console.log('  ✓ Tabular statement parsed correctly');

  // ─── Test 2: Parser — Date Formats & Edge Cases ────────────────
  console.log('Test 2: Parsing various date formats and heuristic lines...');
  const alternateText = `
05-09-2026 Netflix Subscription 649.00
2026-09-06 Grocery Store 800.00
07 Sep 2026 Electric Utility Bill 1500.00
Non-transaction header info line
Page 1 of 2
  `;
  const altResult = parseTransactionsFromText(alternateText);
  assert.strictEqual(altResult.parsed.length, 3, 'Should parse 3 rows with alternative dates');
  assert.strictEqual(altResult.parsed[0].date, '2026-09-05');
  assert.strictEqual(altResult.parsed[1].date, '2026-09-06');
  assert.strictEqual(altResult.parsed[2].date, '2026-09-07');
  console.log('  ✓ Diverse date formats recognized (DD-MM-YYYY, YYYY-MM-DD, DD Mon YYYY)');

  // ─── Test 3: Normalizer — Sanitization & Currency Handling ─────
  console.log('Test 3: Normalizing parsed rows to internal DTOs...');
  const currency = extractCurrencyCode('USD ($)');
  assert.strictEqual(currency, 'USD');
  assert.strictEqual(extractCurrencyCode(null), 'INR');
  assert.strictEqual(extractCurrencyCode('INR (₹)'), 'INR');

  const { normalized, failed } = normalizeTransactions(parseResult.parsed, 'INR (₹)');
  assert.strictEqual(normalized.length, 4, 'All 4 rows should be normalized');
  assert.strictEqual(failed, 0, 'No rows should fail normalization');
  assert.strictEqual(normalized[0].currency, 'INR');
  assert.strictEqual(normalized[0].direction, 'EXPENSE'); // Swiggy DEBIT
  assert.strictEqual(normalized[2].direction, 'INCOME');  // Salary CREDIT
  console.log('  ✓ Rows successfully normalized to ParsedTransaction DTOs');

  // ─── Test 4: Categorizer — Rule-based Category & Type Mapping ──
  console.log('Test 4: Rule-based merchant categorization...');
  const swiggyCat = categorizeTransaction('Swiggy');
  assert.strictEqual(swiggyCat.category, 'FOOD');
  assert.strictEqual(swiggyCat.type, 'VARIABLE');

  const amazonCat = categorizeTransaction('Amazon Retail Private Ltd');
  assert.strictEqual(amazonCat.category, 'SHOPPING');
  assert.strictEqual(amazonCat.type, 'VARIABLE');

  const uberCat = categorizeTransaction('Uber India Technologies');
  assert.strictEqual(uberCat.category, 'TRAVEL');
  assert.strictEqual(uberCat.type, 'VARIABLE');

  const netflixCat = categorizeTransaction('Netflix Entertainment');
  assert.strictEqual(netflixCat.category, 'ENTERTAINMENT');
  assert.strictEqual(netflixCat.type, 'VARIABLE');

  const salaryCat = categorizeTransaction('Monthly Salary Credit');
  assert.strictEqual(salaryCat.category, 'SALARY');
  assert.strictEqual(salaryCat.type, 'FIXED');

  const unknownCat = categorizeTransaction('Random Unknown Merchant 123');
  assert.strictEqual(unknownCat.category, 'OTHER');
  assert.strictEqual(unknownCat.type, 'VARIABLE');
  console.log('  ✓ Categorization and TransactionType assignment verified');

  // ─── Test 5: Deduplication — Deterministic SHA-256 Fingerprint ──
  console.log('Test 5: Deterministic SHA-256 transaction fingerprints...');
  const userId = 'user-uuid-12345';
  const fp1 = generateFingerprint(userId, normalized[0]);
  const fp2 = generateFingerprint(userId, normalized[0]);
  assert.strictEqual(fp1, fp2, 'Fingerprint for identical transaction must match');
  assert.strictEqual(fp1.length, 64, 'Fingerprint must be 64-character SHA-256 hex string');

  // Same merchant, different date -> different fingerprint
  const fpDiffDate = generateFingerprint(userId, {
    ...normalized[0],
    date: new Date('2026-09-10'),
  });
  assert.notStrictEqual(fp1, fpDiffDate, 'Different dates must yield different fingerprints');

  // Same transaction, different user -> different fingerprint
  const fpDiffUser = generateFingerprint('another-user-67890', normalized[0]);
  assert.notStrictEqual(fp1, fpDiffUser, 'Different users must yield different fingerprints');
  console.log('  ✓ Fingerprint uniqueness and determinism verified');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
