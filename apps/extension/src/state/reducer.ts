import type { CreatorProfile, ExperimentOutcome, Recommendation } from '@creator-copilot/shared';
import { initialCreatorState, type CreatorState } from './defaults';
import type { AiSessionStatus } from './auth';

export type CreatorAction =
  | { type: 'save_profile'; profile: CreatorProfile }
  | { type: 'set_recommendations'; recommendations: Recommendation[] }
  | { type: 'complete_recommendation'; id: string }
  | { type: 'dismiss_recommendation'; id: string }
  | { type: 'set_session_context'; context: CreatorState['sessionContext'] }
  | { type: 'check_in_experiment'; outcome: ExperimentOutcome; note: string }
  | { type: 'delete_local_data' }
  | {
      type: 'activate_ai';
      installationId: string;
      token: string;
      expiresAt: string;
      quota: NonNullable<CreatorState['auth']['quota']>;
    }
  | { type: 'set_ai_quota'; quota: NonNullable<CreatorState['auth']['quota']> }
  | { type: 'clear_ai_session'; status: AiSessionStatus };

export function creatorReducer(state: CreatorState, action: CreatorAction): CreatorState {
  switch (action.type) {
    case 'save_profile':
      return { ...state, profile: action.profile };
    case 'set_recommendations':
      return { ...state, recommendations: action.recommendations };
    case 'complete_recommendation':
      return {
        ...state,
        recommendations: state.recommendations.map((item) =>
          item.id === action.id ? { ...item, status: 'completed' } : item,
        ),
      };
    case 'dismiss_recommendation':
      return {
        ...state,
        recommendations: state.recommendations.map((item) =>
          item.id === action.id ? { ...item, status: 'dismissed' } : item,
        ),
      };
    case 'set_session_context':
      return { ...state, sessionContext: action.context };
    case 'check_in_experiment':
      return {
        ...state,
        experiment: {
          ...state.experiment,
          checkIns: [
            ...state.experiment.checkIns,
            { at: new Date().toISOString(), outcome: action.outcome, note: action.note.trim() },
          ],
        },
      };
    case 'delete_local_data':
      return initialCreatorState;
    case 'activate_ai':
      return {
        ...state,
        auth: {
          status: 'active',
          installationId: action.installationId,
          token: action.token,
          expiresAt: action.expiresAt,
          quota: action.quota,
        },
      };
    case 'set_ai_quota':
      return { ...state, auth: { ...state.auth, quota: action.quota } };
    case 'clear_ai_session':
      return { ...state, auth: { ...initialCreatorState.auth, status: action.status } };
  }
}
