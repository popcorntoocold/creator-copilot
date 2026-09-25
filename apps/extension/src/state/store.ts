import { initialCreatorState, type CreatorState } from './defaults';

export type PersistentCreatorState = Omit<CreatorState, 'sessionContext'>;

export type StorageAdapter = {
  read: () => Promise<Partial<PersistentCreatorState> | null>;
  write: (value: PersistentCreatorState) => Promise<void>;
  clear: () => Promise<void>;
};

const STORAGE_KEY = 'creatorCopilotState';

function persistentSlice(state: CreatorState): PersistentCreatorState {
  return {
    profile: state.profile,
    recommendations: state.recommendations,
    experiment: state.experiment,
    auth: state.auth,
  };
}

function createBrowserAdapter(): StorageAdapter {
  const maybeChrome = (
    globalThis as typeof globalThis & {
      chrome?: {
        storage?: {
          local?: {
            get: (key: string) => Promise<Record<string, unknown>>;
            set: (value: Record<string, unknown>) => Promise<void>;
            remove: (key: string) => Promise<void>;
          };
        };
      };
    }
  ).chrome;
  const chromeStorage = maybeChrome?.storage?.local;

  if (chromeStorage) {
    return {
      read: async () => {
        const value = await chromeStorage.get(STORAGE_KEY);
        return (value[STORAGE_KEY] as Partial<PersistentCreatorState> | undefined) ?? null;
      },
      write: async (value) => chromeStorage.set({ [STORAGE_KEY]: value }),
      clear: async () => chromeStorage.remove(STORAGE_KEY),
    };
  }

  return {
    read: async () => {
      const value = globalThis.localStorage?.getItem(STORAGE_KEY);
      return value ? (JSON.parse(value) as Partial<PersistentCreatorState>) : null;
    },
    write: async (value) => globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value)),
    clear: async () => globalThis.localStorage?.removeItem(STORAGE_KEY),
  };
}

export function createMemoryAdapter(): StorageAdapter & { inspect: () => unknown } {
  let value: PersistentCreatorState | null = null;
  return {
    read: async () => structuredClone(value),
    write: async (next) => {
      value = structuredClone(next);
    },
    clear: async () => {
      value = null;
    },
    inspect: () => structuredClone(value),
  };
}

export async function loadPersistentState(
  adapter: StorageAdapter = createBrowserAdapter(),
): Promise<CreatorState> {
  const stored = await adapter.read();
  if (!stored) return initialCreatorState;
  return {
    profile: stored.profile ?? initialCreatorState.profile,
    recommendations: stored.recommendations ?? initialCreatorState.recommendations,
    experiment: stored.experiment ?? initialCreatorState.experiment,
    auth: stored.auth ?? initialCreatorState.auth,
    sessionContext: null,
  };
}

export async function savePersistentState(
  state: CreatorState,
  adapter: StorageAdapter = createBrowserAdapter(),
): Promise<void> {
  await adapter.write(persistentSlice(state));
}

export async function clearPersistentState(
  adapter: StorageAdapter = createBrowserAdapter(),
): Promise<void> {
  await adapter.clear();
}
