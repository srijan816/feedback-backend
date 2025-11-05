/**
 * Secondary Student 8-Rubric System
 *
 * This file defines the 8 rubrics used for all secondary student feedback.
 * Based on analysis of 76 actual feedback documents from secondary classes.
 */

// ============================================
// RUBRIC NAMES (Type-safe constants)
// ============================================

export const SECONDARY_RUBRIC_NAMES = {
  TIME_MANAGEMENT: 'Time Management',
  POI_ENGAGEMENT: 'POI Engagement',
  DELIVERY_STYLE: 'Delivery & Style',
  ARGUMENT_COMPLETENESS: 'Argument Completeness',
  THEORY_APPLICATION: 'Theory Application',
  REBUTTAL_EFFECTIVENESS: 'Rebuttal Effectiveness',
  TEAMWORK_EXTENSION: 'Teamwork & Extension',
  FEEDBACK_IMPLEMENTATION: 'Feedback Implementation',
} as const;

export type SecondaryRubricName = typeof SECONDARY_RUBRIC_NAMES[keyof typeof SECONDARY_RUBRIC_NAMES];

// ============================================
// RUBRIC SCORING SCALE
// ============================================

/**
 * Scoring scale for all secondary rubrics
 * Based on universal scale found in all 76 feedback documents
 */
export type RubricScore = 'NA' | 1 | 2 | 3 | 4 | 5;

export interface RubricScoreDefinition {
  score: RubricScore;
  label: string;
  description: string;
}

/**
 * Universal scoring scale definitions
 */
export const RUBRIC_SCORE_DEFINITIONS: RubricScoreDefinition[] = [
  {
    score: 'NA',
    label: 'Not Applicable',
    description: 'Not applicable for this speech type or role (e.g., "rebuttal" for first speaker)',
  },
  {
    score: 1,
    label: 'Unobserved',
    description: 'The skill was not demonstrated at all',
  },
  {
    score: 2,
    label: 'Needs Extended Support',
    description: 'Student attempt noted. Needs extended teacher support to properly execute skill.',
  },
  {
    score: 3,
    label: 'Competent with Guidance',
    description: 'Student effort noted. Can execute skill with minimal teacher input and guidance.',
  },
  {
    score: 4,
    label: 'Independent Proficiency',
    description: 'Student can execute skill with little to no prompting.',
  },
  {
    score: 5,
    label: 'Exceptional Mastery',
    description: 'Student can execute skill without prompting; exceeds expectations for child of that level.',
  },
];

// ============================================
// RUBRIC METADATA
// ============================================

export interface SecondaryRubricMetadata {
  name: SecondaryRubricName;
  category: 'Structure' | 'Engagement' | 'Delivery' | 'Content' | 'Strategy' | 'Development';
  description: string;
  displayOrder: number;
  canBeNA: boolean; // Can this rubric receive an N/A score?
  naConditions?: string[]; // When is N/A appropriate?
}

/**
 * Complete metadata for all 8 secondary rubrics
 */
export const SECONDARY_RUBRICS_METADATA: SecondaryRubricMetadata[] = [
  {
    name: SECONDARY_RUBRIC_NAMES.TIME_MANAGEMENT,
    category: 'Structure',
    description: 'Student spoke for the duration of the specified time frame',
    displayOrder: 1,
    canBeNA: false,
  },
  {
    name: SECONDARY_RUBRIC_NAMES.POI_ENGAGEMENT,
    category: 'Engagement',
    description: 'Student offered and/or accepted a point of information relevant to the topic',
    displayOrder: 2,
    canBeNA: true,
    naConditions: ['Reply speeches', 'Debate formats without POIs'],
  },
  {
    name: SECONDARY_RUBRIC_NAMES.DELIVERY_STYLE,
    category: 'Delivery',
    description: 'Student spoke in a stylistic and persuasive manner (e.g. volume, speed, tone, diction, and flow)',
    displayOrder: 3,
    canBeNA: false,
  },
  {
    name: SECONDARY_RUBRIC_NAMES.ARGUMENT_COMPLETENESS,
    category: 'Content',
    description: 'Student\'s argument is complete in that it has relevant claims, supported by sufficient reasoning, examples, impacts, and implications',
    displayOrder: 4,
    canBeNA: false,
  },
  {
    name: SECONDARY_RUBRIC_NAMES.THEORY_APPLICATION,
    category: 'Strategy',
    description: 'Student argument reflects application of theory taught during class time (e.g. strategic framing, weighing, stakeholder analysis, burden shifts, counter set-ups)',
    displayOrder: 5,
    canBeNA: false,
  },
  {
    name: SECONDARY_RUBRIC_NAMES.REBUTTAL_EFFECTIVENESS,
    category: 'Content',
    description: 'Student\'s rebuttal is effective, and directly responds to an opponent\'s arguments',
    displayOrder: 6,
    canBeNA: true,
    naConditions: ['First speakers (Prop 1, Opp 1) with no prior speeches to rebut'],
  },
  {
    name: SECONDARY_RUBRIC_NAMES.TEAMWORK_EXTENSION,
    category: 'Strategy',
    description: 'Student ably supported teammate\'s case and arguments',
    displayOrder: 7,
    canBeNA: true,
    naConditions: ['First speakers', 'Solo debate formats'],
  },
  {
    name: SECONDARY_RUBRIC_NAMES.FEEDBACK_IMPLEMENTATION,
    category: 'Development',
    description: 'Student applied feedback from previous debate(s)',
    displayOrder: 8,
    canBeNA: true,
    naConditions: ['First debate with no prior feedback available'],
  },
];

// ============================================
// SCORING RESULT TYPES
// ============================================

/**
 * Individual rubric score with metadata
 */
export interface SecondaryRubricScore {
  rubric: SecondaryRubricName;
  score: RubricScore;
  justification?: string; // Why this score was given (for LLM-generated feedback)
}

/**
 * Complete scoring result for a speech
 */
export interface SecondaryScoringResult {
  scores: Record<SecondaryRubricName, RubricScore>;
  averageScore?: number; // Average of numeric scores (excluding NA)
  totalPossibleScore?: number;
  scorePercentage?: number; // (average / 5) * 100
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get rubric metadata by name
 */
export function getRubricMetadata(rubricName: SecondaryRubricName): SecondaryRubricMetadata | undefined {
  return SECONDARY_RUBRICS_METADATA.find(r => r.name === rubricName);
}

/**
 * Check if a rubric can be scored as N/A
 */
export function canRubricBeNA(rubricName: SecondaryRubricName): boolean {
  const metadata = getRubricMetadata(rubricName);
  return metadata?.canBeNA ?? false;
}

/**
 * Get all rubric names in display order
 */
export function getAllRubricNames(): SecondaryRubricName[] {
  return SECONDARY_RUBRICS_METADATA
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(r => r.name);
}

/**
 * Calculate average score from scoring result (excluding N/A values)
 */
export function calculateAverageScore(scores: Record<SecondaryRubricName, RubricScore>): number {
  const numericScores = Object.values(scores)
    .filter((score) => typeof score === 'number') as number[];

  if (numericScores.length === 0) return 0;

  const sum = numericScores.reduce((acc: number, score: number) => acc + score, 0);
  return sum / numericScores.length;
}

/**
 * Calculate score percentage (out of 5)
 */
export function calculateScorePercentage(scores: Record<SecondaryRubricName, RubricScore>): number {
  const average = calculateAverageScore(scores);
  return (average / 5) * 100;
}

/**
 * Determine if a rubric should be N/A based on speaker position
 */
export function shouldRubricBeNA(
  rubricName: SecondaryRubricName,
  speakerPosition: string
): boolean {
  // First speakers (Prop 1, Opp 1) don't have rebuttal requirements
  if (rubricName === SECONDARY_RUBRIC_NAMES.REBUTTAL_EFFECTIVENESS) {
    return speakerPosition === 'Prop 1' || speakerPosition === 'Opp 1';
  }

  // First speakers don't have teammates to extend yet
  if (rubricName === SECONDARY_RUBRIC_NAMES.TEAMWORK_EXTENSION) {
    return speakerPosition === 'Prop 1' || speakerPosition === 'Opp 1';
  }

  // Reply speeches typically don't offer POIs
  if (rubricName === SECONDARY_RUBRIC_NAMES.POI_ENGAGEMENT) {
    return speakerPosition.toLowerCase().includes('reply');
  }

  return false;
}

/**
 * Create a default scoring result with appropriate N/A values
 */
export function createDefaultScoring(speakerPosition: string): SecondaryScoringResult {
  const scores: Record<string, RubricScore> = {};

  for (const rubric of SECONDARY_RUBRICS_METADATA) {
    if (shouldRubricBeNA(rubric.name, speakerPosition)) {
      scores[rubric.name] = 'NA';
    } else {
      scores[rubric.name] = 3; // Default to "competent" score
    }
  }

  return {
    scores: scores as Record<SecondaryRubricName, RubricScore>,
    averageScore: calculateAverageScore(scores as Record<SecondaryRubricName, RubricScore>),
    scorePercentage: calculateScorePercentage(scores as Record<SecondaryRubricName, RubricScore>),
  };
}
