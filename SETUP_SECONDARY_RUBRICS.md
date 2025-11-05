# Setting Up Secondary 8-Rubric System

This guide walks through setting up the Mai 8-rubric system for secondary students.

---

## Prerequisites

- PostgreSQL database running
- Access to `psql` command or database client
- Backup of current database (recommended)

---

## Step 1: Backup Current Rubrics (Optional but Recommended)

```bash
# Backup current rubrics table
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "COPY (SELECT * FROM rubrics WHERE student_level = 'secondary') TO '/tmp/old_rubrics_backup.csv' CSV HEADER;"
```

---

## Step 2: Run the Migration

```bash
# Run the secondary rubrics migration
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -f database/migrations/001_mai_rubrics.sql
```

**Expected output:**
```
UPDATE 5                                    -- Deactivated old rubrics
INSERT 0 8                                  -- Inserted 8 new rubrics
CREATE VIEW                                 -- Created view
NOTICE: Migration successful: 8 secondary rubrics active for secondary level
DO
```

---

## Step 3: Verify the Migration

### Check Active Secondary Rubrics

```bash
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT name, category, display_order FROM rubrics WHERE student_level = 'secondary' AND is_active = true ORDER BY display_order;"
```

**Expected output:**
```
          name          |  category   | display_order
------------------------+-------------+---------------
 Time Management        | Structure   |             1
 POI Engagement         | Engagement  |             2
 Delivery & Style       | Delivery    |             3
 Argument Completeness  | Content     |             4
 Theory Application     | Strategy    |             5
 Rebuttal Effectiveness | Content     |             6
 Teamwork & Extension   | Strategy    |             7
 Feedback Implementation| Development |             8
(8 rows)
```

### Check Rubric Criteria Details

```bash
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT name, criteria->>'5' as score_5, criteria->>'3' as score_3, criteria->>'1' as score_1 FROM rubrics WHERE student_level = 'secondary' AND is_active = true ORDER BY display_order LIMIT 3;"
```

This will show you the scoring criteria for scores 5, 3, and 1 for the first 3 rubrics.

### Use the Convenience View

```bash
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT * FROM active_secondary_rubrics;"
```

---

## Step 4: Verify Old Rubrics are Deactivated

```bash
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT name, is_active FROM rubrics WHERE student_level = 'secondary' AND is_active = false;"
```

**Expected output:**
```
          name          | is_active
------------------------+-----------
 Argumentation          | f
 Rebuttal Quality       | f
 Evidence & Examples    | f
 Speaking Rate & Clarity| f
 Role Fulfillment       | f
(5 rows)
```

---

## Step 5: Test with TypeScript

Create a test script to verify the types work correctly:

```typescript
// test-mai-rubrics.ts
import {
  SECONDARY_RUBRIC_NAMES,
  getAllRubricNames,
  createDefaultScoring,
  calculateAverageScore,
  shouldRubricBeNA
} from './src/types/mai-rubrics';

console.log('=== Secondary Rubrics Test ===\n');

// Test 1: Get all rubric names
console.log('1. All Rubric Names:');
const rubrics = getAllRubricNames();
rubrics.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));

// Test 2: Create default scoring for Prop 1
console.log('\n2. Default Scoring for Prop 1:');
const prop1Scoring = createDefaultScoring('Prop 1');
console.log('   Scores:', JSON.stringify(prop1Scoring.scores, null, 2));
console.log('   Average:', prop1Scoring.averageScore);

// Test 3: Check N/A logic
console.log('\n3. N/A Logic Tests:');
console.log('   Should Rebuttal be N/A for Prop 1?', shouldRubricBeNA(SECONDARY_RUBRIC_NAMES.REBUTTAL_EFFECTIVENESS, 'Prop 1'));
console.log('   Should Rebuttal be N/A for Prop 2?', shouldRubricBeNA(SECONDARY_RUBRIC_NAMES.REBUTTAL_EFFECTIVENESS, 'Prop 2'));
console.log('   Should Teamwork be N/A for Opp 1?', shouldRubricBeNA(SECONDARY_RUBRIC_NAMES.TEAMWORK_EXTENSION, 'Opp 1'));

console.log('\n=== Tests Complete ===');
```

Run the test:
```bash
npx ts-node test-mai-rubrics.ts
```

---

## Rollback (If Needed)

If you need to revert to the old rubrics:

```bash
# Reactivate old rubrics
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "UPDATE rubrics SET is_active = true WHERE student_level = 'secondary' AND name IN ('Argumentation', 'Rebuttal Quality', 'Evidence & Examples', 'Speaking Rate & Clarity', 'Role Fulfillment');"

# Deactivate secondary rubrics
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "UPDATE rubrics SET is_active = false WHERE student_level = 'secondary' AND name IN ('Time Management', 'POI Engagement', 'Delivery & Style', 'Argument Completeness', 'Theory Application', 'Rebuttal Effectiveness', 'Teamwork & Extension', 'Feedback Implementation');"
```

---

## What's Next?

After setting up the rubrics:

1. **Update Feedback Service** - Modify `src/services/feedback.ts` to use the 8 secondary rubrics
2. **Update Prompts** - Update prompt templates to score on the 8 new rubrics
3. **Test Feedback Generation** - Generate test feedback to ensure rubrics are scored correctly
4. **Update Frontend** - Ensure iOS/web apps display all 8 rubrics

---

## Key Files

- **Migration:** `database/migrations/001_mai_rubrics.sql`
- **Types:** `src/types/mai-rubrics.ts`
- **Guide:** `SECONDARY_RUBRICS_GUIDE.md`
- **Analysis:** `FEEDBACK_ANALYSIS_FINDINGS.md`

---

## Questions?

Check the comprehensive guides:
- **Scoring Guide:** `SECONDARY_RUBRICS_GUIDE.md` - How to score each rubric
- **Analysis:** `FEEDBACK_ANALYSIS_FINDINGS.md` - Deep analysis of feedback structure
