import assert from 'node:assert';
import { parseCsv, detectColumns } from '../src/import/csvParser';
import {
  normalizeRows,
  parseAmountString,
  detectDateFormatFromSamples,
  parseDateToUtc,
} from '../src/import/normalize';
import { calculateFingerprint, fingerprintRows } from '../src/import/fingerprint';

async function runUnitTests() {
  console.log('Running Finia CSV Transaction Import Pipeline Tests...\n');

  // ─── Test 1: Signed-amount CSV ──────────────────────────────────────────
  console.log('Test 1: Signed-amount CSV...');
  const signedCsv = `Date,Description,Amount
2026-09-01,Starbucks Coffee,-450.00
2026-09-02,Salary Payment,50000.00
2026-09-03,Grocery Store,-1250.75
`;
  const parsed1 = parseCsv(Buffer.from(signedCsv));
  assert.strictEqual(parsed1.columns.layout.type, 'single');
  const norm1 = normalizeRows(parsed1.rows, parsed1.columns);
  assert.strictEqual(norm1.normalized.length, 3);
  assert.strictEqual(norm1.failed.length, 0);

  // Row 1: Starbucks
  assert.strictEqual(norm1.normalized[0].title, 'Starbucks Coffee');
  assert.strictEqual(norm1.normalized[0].amount, 450);
  assert.strictEqual(norm1.normalized[0].direction, 'EXPENSE');
  assert.strictEqual(norm1.normalized[0].type, 'VARIABLE');
  assert.strictEqual(norm1.normalized[0].category, 'OTHER');
  assert.strictEqual(norm1.normalized[0].source, 'CSV');

  // Row 2: Salary
  assert.strictEqual(norm1.normalized[1].title, 'Salary Payment');
  assert.strictEqual(norm1.normalized[1].amount, 50000);
  assert.strictEqual(norm1.normalized[1].direction, 'INCOME');
  assert.strictEqual(norm1.normalized[1].type, 'FIXED');

  console.log('  ✓ Signed amount parsed with correct positive amounts and direction');

  // ─── Test 2: Debit/Credit-columns CSV ────────────────────────────────────
  console.log('Test 2: Debit/credit-columns CSV...');
  const debitCreditCsv = `Date,Narration,Debit,Credit
01/10/2026,Amazon Shopping,1200.00,
02/10/2026,Interest Credited,,350.50
`;
  const parsed2 = parseCsv(Buffer.from(debitCreditCsv));
  assert.strictEqual(parsed2.columns.layout.type, 'separate');
  const norm2 = normalizeRows(parsed2.rows, parsed2.columns);
  assert.strictEqual(norm2.normalized.length, 2);
  assert.strictEqual(norm2.failed.length, 0);

  // Amazon
  assert.strictEqual(norm2.normalized[0].amount, 1200);
  assert.strictEqual(norm2.normalized[0].direction, 'EXPENSE');
  // Interest
  assert.strictEqual(norm2.normalized[1].amount, 350.5);
  assert.strictEqual(norm2.normalized[1].direction, 'INCOME');
  console.log('  ✓ Separate debit/credit columns parsed accurately');

  // ─── Test 3: Dr/Cr type column CSV ───────────────────────────────────────
  console.log('Test 3: Dr/Cr type column CSV...');
  const drCrCsv = `Txn Date,Details,Amount,Type
05/10/2026,Uber Ride,240.00,Dr
06/10/2026,Cashback,50.00,Cr
`;
  const parsed3 = parseCsv(Buffer.from(drCrCsv));
  assert.strictEqual(parsed3.columns.layout.type, 'typed');
  const norm3 = normalizeRows(parsed3.rows, parsed3.columns);
  assert.strictEqual(norm3.normalized.length, 2);
  assert.strictEqual(norm3.normalized[0].direction, 'EXPENSE');
  assert.strictEqual(norm3.normalized[1].direction, 'INCOME');
  console.log('  ✓ Dr/Cr type column layout parsed accurately');

  // ─── Test 4: DD/MM vs MM/DD detection + ambiguous warning ───────────────
  console.log('Test 4: DD/MM vs MM/DD detection + ambiguous warning...');
  // 4a. DD/MM: first part has 25 > 12
  const ddmmSamples = ['25/08/2026', '10/08/2026'];
  const ddmmRes = detectDateFormatFromSamples(ddmmSamples);
  assert.strictEqual(ddmmRes.format, 'DD/MM/YYYY');
  assert.strictEqual(ddmmRes.ambiguous, false);

  // 4b. MM/DD: second part has 25 > 12
  const mmddSamples = ['08/25/2026', '08/10/2026'];
  const mmddRes = detectDateFormatFromSamples(mmddSamples);
  assert.strictEqual(mmddRes.format, 'MM/DD/YYYY');
  assert.strictEqual(mmddRes.ambiguous, false);

  // 4c. Ambiguous: both parts <= 12
  const ambigSamples = ['05/06/2026', '07/08/2026'];
  const ambigRes = detectDateFormatFromSamples(ambigSamples);
  assert.strictEqual(ambigRes.format, 'DD/MM/YYYY');
  assert.strictEqual(ambigRes.ambiguous, true);

  // Verify warning is produced during normalization of ambiguous CSV
  const ambigCsv = `Date,Description,Amount
05/06/2026,Coffee,50.00
`;
  const parsedAmbig = parseCsv(Buffer.from(ambigCsv));
  const normAmbig = normalizeRows(parsedAmbig.rows, parsedAmbig.columns);
  assert.strictEqual(normAmbig.warnings.length, 1);
  assert.ok(normAmbig.warnings[0].includes('ambiguous'));
  console.log('  ✓ DD/MM vs MM/DD and ambiguous warning working correctly');

  // ─── Test 5: "(1,200.00)" and "₹1,200.50" ───────────────────────────────
  console.log('Test 5: (1,200.00) and ₹1,200.50 amount formats...');
  const parenRes = parseAmountString('(1,200.00)');
  assert.ok(parenRes);
  assert.strictEqual(parenRes.value, 1200);
  assert.strictEqual(parenRes.isNegative, true);

  const inrRes = parseAmountString('₹1,200.50');
  assert.ok(inrRes);
  assert.strictEqual(inrRes.value, 1200.5);
  assert.strictEqual(inrRes.isNegative, false);

  const usdRes = parseAmountString('-$3,500.99');
  assert.ok(usdRes);
  assert.strictEqual(usdRes.value, 3500.99);
  assert.strictEqual(usdRes.isNegative, true);
  console.log('  ✓ Currency symbols and accounting parentheses parsed correctly');

  // ─── Test 6: Identical same-day rows get different fingerprints ──────────
  console.log('Test 6: Identical same-day rows & idempotent fingerprinting...');
  const duplicateRowsCsv = `Date,Description,Amount
2026-09-01,Chai Point,50.00
2026-09-01,Chai Point,50.00
2026-09-01,Chai Point,50.00
`;
  const parsedDup = parseCsv(Buffer.from(duplicateRowsCsv));
  const normDup = normalizeRows(parsedDup.rows, parsedDup.columns);
  const userId1 = 'user-alpha-123';
  const fpRows1 = fingerprintRows(userId1, normDup.normalized);

  // Verify 3 distinct fingerprints due to occurrenceIndex
  assert.strictEqual(fpRows1.length, 3);
  assert.strictEqual(fpRows1[0].occurrenceIndex, 0);
  assert.strictEqual(fpRows1[1].occurrenceIndex, 1);
  assert.strictEqual(fpRows1[2].occurrenceIndex, 2);
  assert.notStrictEqual(fpRows1[0].importFingerprint, fpRows1[1].importFingerprint);
  assert.notStrictEqual(fpRows1[1].importFingerprint, fpRows1[2].importFingerprint);

  // Same file twice produces the exact same set of fingerprints
  const fpRows2 = fingerprintRows(userId1, normDup.normalized);
  assert.strictEqual(fpRows1[0].importFingerprint, fpRows2[0].importFingerprint);
  assert.strictEqual(fpRows1[1].importFingerprint, fpRows2[1].importFingerprint);
  assert.strictEqual(fpRows1[2].importFingerprint, fpRows2[2].importFingerprint);

  // Different user produces completely different fingerprints (no cross-user collision)
  const userId2 = 'user-beta-456';
  const fpRowsOtherUser = fingerprintRows(userId2, normDup.normalized);
  assert.notStrictEqual(fpRows1[0].importFingerprint, fpRowsOtherUser[0].importFingerprint);
  console.log('  ✓ Occurrence indexing, deterministic hashing, and user scoping verified');

  // ─── Test 7: Bad row reported with row number + reason ───────────────────
  console.log('Test 7: Bad row reporting with row numbers...');
  const badCsv = `Date,Description,Amount
2026-09-01,Valid First Row,100.00
,Missing Date,200.00
2026-09-03,,300.00
2026-09-04,Invalid Amount,ABC
   
2026-09-05,Valid Fifth Row,500.00
`;
  const parsedBad = parseCsv(Buffer.from(badCsv));
  const normBad = normalizeRows(parsedBad.rows, parsedBad.columns);

  assert.strictEqual(normBad.normalized.length, 2);
  assert.strictEqual(normBad.failed.length, 3);

  // Row numbers: Header is row 1.
  // 2026-09-01,Valid First Row,100.00 -> row 2 (valid)
  // ,Missing Date,200.00 -> row 3 (failed)
  // 2026-09-03,,300.00 -> row 4 (failed)
  // 2026-09-04,Invalid Amount,ABC -> row 5 (failed)
  // Blank row -> row 6 (silently skipped)
  // 2026-09-05,Valid Fifth Row,500.00 -> row 7 (valid)
  assert.strictEqual(normBad.failed[0].row, 3);
  assert.ok(normBad.failed[0].reason.includes('date'));
  assert.strictEqual(normBad.failed[1].row, 4);
  assert.ok(normBad.failed[1].reason.includes('Description'));
  assert.strictEqual(normBad.failed[2].row, 5);
  assert.ok(normBad.failed[2].reason.includes('amount'));

  console.log('  ✓ Bad rows reported with accurate 1-based row numbers and reasons');

  // ─── Test 8: Guardrails & Column Detection Edge Cases ───────────────────
  console.log('Test 8: Guardrails and unknown columns 422...');
  let threw422 = false;
  try {
    parseCsv(Buffer.from(`ColA,ColB,ColC\n1,2,3\n`));
  } catch (err: any) {
    threw422 = true;
    assert.strictEqual(err.statusCode, 422);
    assert.deepStrictEqual(err.details?.detectedHeaders, ['ColA', 'ColB', 'ColC']);
  }
  assert.strictEqual(threw422, true);

  let threwEmpty = false;
  try {
    parseCsv(Buffer.from(''));
  } catch (err: any) {
    threwEmpty = true;
    assert.strictEqual(err.statusCode, 400);
  }
  assert.strictEqual(threwEmpty, true);

  console.log('  ✓ Guardrails enforce 400 on empty and 422 with detected headers');

  console.log('\n🎉 ALL 8 CSV IMPORT UNIT TESTS PASSED SUCCESSFULLY!');
}

runUnitTests().catch((err) => {
  console.error('\n❌ CSV Import Unit Tests Failed:', err);
  process.exit(1);
});
