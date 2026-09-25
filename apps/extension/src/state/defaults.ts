import type {
  CreatorProfile,
  Experiment,
  PageContext,
  Recommendation,
} from '@creator-copilot/shared';
import { initialAuthState, type AiSessionState } from './auth';

export type CreatorState = {
  profile: CreatorProfile | null;
  recommendations: Recommendation[];
  experiment: Experiment;
  sessionContext: PageContext | null;
  auth: AiSessionState;
};

export const initialExperiment: Experiment = {
  id: 'specific-question-week',
  title: 'The specific-question week',
  hypothesis: 'Specific questions will create more useful public replies than generic prompts.',
  instructions: [
    'Choose one recurring theme your audience already recognizes.',
    'End three posts this week with one precise, answerable question.',
    'Record profile visits, useful replies, and qualified conversations.',
  ],
  metric: 'Useful public replies and qualified conversations',
  status: 'active',
  checkIns: [],
};

export const initialCreatorState: CreatorState = {
  profile: null,
  recommendations: [],
  experiment: initialExperiment,
  sessionContext: null,
  auth: initialAuthState,
};
