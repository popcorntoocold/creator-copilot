import type { RequestInput } from './detector';

const TIMESTAMP =
  /^(now|\d+[smhdw]|\d{1,2}:\d{2}\s?(am|pm)?|[A-Z][a-z]{2} \d{1,2}(, \d{4})?|yesterday|(mon|tue|wed|thu|fri|sat|sun)[a-z]*)$/i;
const FOLLOWERS = /^([\d.,]+)\s*([KkMm])?\s+Followers?$/;
const HANDLE = /^@[A-Za-z0-9_]{1,15}$/;
const NOISE = (line: string) => line === '·' || TIMESTAMP.test(line) || FOLLOWERS.test(line) || /followed by|you follow/i.test(line);

function parseFollowers(lines: string[]): number | undefined {
  for (const line of lines) {
    const match = FOLLOWERS.exec(line);
    if (!match) continue;
    const base = Number(match[1]!.replaceAll(',', ''));
    const scale = { k: 1e3, m: 1e6 }[match[2]?.toLowerCase() ?? ''] ?? 1;
    return Math.round(base * scale);
  }
  return undefined;
}

// A DM message's own text is ignored when it's the viewer's reply ("You: ...").
function messageText(lines: string[]) {
  const text = lines.filter((line) => !NOISE(line)).join('\n');
  return /^You:/.test(text) ? '' : text;
}

/**
 * Parses a DM list row's innerText.
 * - Legacy inbox rows: "name\n@handle\n·\n2h\npreview".
 * - XChat request rows have no handle: "name\ntime\npreview\n12 Followers".
 * `requireHandle` keeps the legacy selectors from matching unrelated links.
 */
export function parseRowText(raw: string, options: { requireHandle?: boolean; description?: string | null } = {}): RequestInput | null {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const followers = parseFollowers(lines);
  const handleIndex = lines.findIndex((line) => HANDLE.test(line));

  if (handleIndex !== -1) {
    return {
      displayName: lines[handleIndex - 1] ?? '',
      handle: lines[handleIndex]!.slice(1),
      text: messageText(lines.slice(handleIndex + 1)),
      ...(followers === undefined ? {} : { followers }),
    };
  }
  if (options.requireHandle || !lines[0]) return null;

  // XChat inbox rows carry "name, @handle, preview, 53m" in aria-description.
  const described = options.description?.match(/, @([A-Za-z0-9_]{1,15}), /)?.[1];
  return {
    displayName: lines[0],
    handle: described ?? '',
    text: messageText(lines.slice(1)),
    ...(followers === undefined ? {} : { followers }),
  };
}
