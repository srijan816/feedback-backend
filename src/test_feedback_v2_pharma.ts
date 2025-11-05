/**
 * Test Feedback V2 Generation - Pharmaceutical Speech
 * Generates feedback for Speaker B from the full debate transcript
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFeedbackV2, FeedbackV2Result } from './services/feedbackV2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('='.repeat(80));
  console.log('TESTING FEEDBACK V2 - PHARMACEUTICAL SPEECH (SPEAKER B)');
  console.log('='.repeat(80));
  console.log();

  // Read test input metadata
  const inputPath = path.join(__dirname, '../test_data/feedback_v2_pharma_input.json');

  if (!fs.existsSync(inputPath)) {
    console.error('❌ Test input not found. Run: python3 generate_v2_for_speaker.py');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  console.log('📋 Test Input:');
  console.log(`  Transcript ID: ${input.transcript_id}`);
  console.log(`  Speaker Filter: ${input.speaker_filter}`);
  console.log(`  Motion: ${input.motion}`);
  console.log(`  Position: ${input.position}`);
  console.log(`  Duration: ${input.actual_time_seconds}s`);
  console.log();

  console.log('🔄 Generating V2 feedback for pharmaceutical speech...');
  console.log();

  try {
    const result: FeedbackV2Result = await generateFeedbackV2({
      transcriptId: input.transcript_id,
      motion: input.motion,
      position: input.position,
      expectedDuration: input.expected_duration,
      actualTimeSeconds: input.actual_time_seconds,
      audioUrl: input.audio_url,
      speakerFilter: input.speaker_filter
    });

    console.log('✓ Feedback generated successfully!');
    console.log();

    // Display results
    console.log('='.repeat(80));
    console.log('📊 RUBRIC SCORES');
    console.log('='.repeat(80));
    console.log(`Average: ${result.rubric_scores.average_score.toFixed(1)}/5`);
    console.log(`Scored: ${result.rubric_scores.total_scored_rubrics}/8 rubrics`);
    console.log();

    Object.entries(result.rubric_scores.scores).forEach(([rubric, score]) => {
      console.log(`  ${rubric}: ${score}`);
    });

    console.log();
    console.log('='.repeat(80));
    console.log('💬 STRATEGIC OVERVIEW');
    console.log('='.repeat(80));

    console.log();
    console.log('Hook & Signposting:');
    console.log(result.strategic_overview.hook_and_signposting);

    console.log();
    console.log('Strategic Assessment:');
    console.log(result.strategic_overview.strategic_assessment);

    console.log();
    console.log('Missing Arguments:');
    console.log(result.strategic_overview.missing_arguments);

    console.log();
    console.log('='.repeat(80));
    console.log(`🎧 PLAYABLE MOMENTS (${result.playable_moments.length})`);
    console.log('='.repeat(80));

    result.playable_moments.forEach((moment, idx) => {
      const icon = moment.severity === 'praise' ? '✅' : '❌';
      console.log();
      console.log(`${icon} [${idx + 1}] [▶ ${moment.start_time}] ${moment.category.toUpperCase()}`);
      console.log(`Chunk ID: ${moment.chunk_id}`);
      console.log();
      console.log(`What they said:`);
      console.log(`"${moment.what_they_said.substring(0, 150)}..."`);
      console.log();
      console.log(`Issue:`);
      console.log(moment.issue.substring(0, 200) + '...');
      console.log();
      console.log(`[Play ${moment.start_time} - ${moment.end_time} (${moment.end_seconds - moment.start_seconds}s)]`);
    });

    console.log();
    console.log('='.repeat(80));
    console.log('📁 METADATA');
    console.log('='.repeat(80));
    console.log(`Total Chunks: ${result.chunks_metadata.total_chunks}`);
    console.log(`Chunk Labels: ${result.chunks_metadata.chunk_labels.join(', ')}`);
    console.log(`Audio Duration: ${result.audio_metadata.duration_seconds}s`);

    // Save result
    const outputPath = path.join(__dirname, '../test_data/feedback_v2_pharma_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log();
    console.log(`✓ Results saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error generating feedback:');
    console.error(error);
    process.exit(1);
  }
}

main();
