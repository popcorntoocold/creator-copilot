// Local, heuristic scoring for X message requests. Nothing leaves the browser.

export type Verdict = 'clean' | 'suspicious' | 'likely';

export interface Signal {
  label: string;
  weight: number;
}

export interface Score {
  score: number; // 0-100
  verdict: Verdict;
  signals: Signal[];
}

export interface RequestInput {
  displayName: string;
  handle: string;
  text: string;
  followers?: number;
}

export interface Assessment {
  ai: Score;
  spam: Score;
}

interface Rule {
  label: string;
  weight: number;
  test: (input: RequestInput) => boolean;
}

const phrase = (pattern: RegExp) => (input: RequestInput) => pattern.test(input.text);

const AI_RULES: Rule[] = [
  {
    label: 'Stock outreach opener',
    weight: 30,
    test: phrase(
      /\b(i hope (this|my) (message|note|dm) finds you|hope you('| a)re (doing )?well|i came across your (profile|page|account|work)|i stumbled (up)?on your|i('ve| have) been following your (work|journey|content))\b/i,
    ),
  },
  {
    label: 'LLM vocabulary',
    weight: 20,
    test: phrase(
      /\b(delve|tapestry|testament to|resonates? (deeply )?with|elevate your|unlock(ing)? (your|the) (full )?potential|seamless(ly)?|synerg(y|ies)|leverage|in today's (fast-paced|digital)|navigat(e|ing) the (world|landscape)|game[- ]changer|truly inspiring|i'm genuinely)\b/i,
    ),
  },
  {
    label: 'Generic flattery',
    weight: 15,
    test: phrase(
      /\b(your (content|work|posts?|profile) (is|are) (truly |really )?(amazing|inspiring|impressive|incredible|outstanding)|i('m| am) (truly |really )?(impressed|inspired) by|love what you('re| are) (doing|building))\b/i,
    ),
  },
  {
    label: 'Templated pitch',
    weight: 15,
    test: phrase(
      /\b(i('d| would) love to (connect|collaborate|explore|discuss|chat)|(potential|exciting) (collaboration|partnership|opportunity)|let me know if you('re| are) (open|interested)|looking forward to (hearing|your response)|feel free to reach out|mutually beneficial)\b/i,
    ),
  },
  {
    label: 'Em dashes',
    weight: 10,
    test: (input) => (input.text.match(/—/g) ?? []).length >= 2,
  },
  {
    label: 'Formal letter structure',
    weight: 10,
    test: phrase(/(^|\n)\s*(dear|greetings)\b|\b(best regards|kind regards|warm regards|sincerely),?\s*$/im),
  },
  {
    label: 'Long polished first message',
    weight: 10,
    test: (input) => {
      const words = input.text.split(/\s+/).filter(Boolean).length;
      return words >= 60 && !/\b(lol|lmao|tbh|ngl|u|ur|gonna|wanna)\b/i.test(input.text);
    },
  },
];

const SPAM_RULES: Rule[] = [
  {
    label: 'Crypto / investment pitch',
    weight: 35,
    test: phrase(
      /\b(crypto|bitcoin|btc|usdt|forex|nft|airdrop|presale|trading (signals?|account)|invest(ment|ing)? (opportunity|plan|platform)|passive income|(daily|weekly) (profit|returns?)|roi|mining)\b/i,
    ),
  },
  {
    label: 'Moves you off-platform',
    weight: 30,
    test: phrase(/\b(telegram|whats ?app|signal app|wechat|kik|snap(chat)?|t\.me\/|wa\.me\/|text me (at|on))\b/i),
  },
  {
    label: 'Promotion / growth service',
    weight: 30,
    test: phrase(
      /\b(promot(e|ion|ing) your (account|page|content|music|brand)|grow your (account|following|audience)|(gain|get) (real )?(followers|engagement)|shout ?out|(boost|increase) your (reach|engagement)|marketing (agency|services?)|ghost ?writ(er|ing))\b/i,
    ),
  },
  {
    label: 'Romance / sugar bait',
    weight: 35,
    test: phrase(/\b(sugar (daddy|mommy|baby)|allowance|lonely|looking for (love|a (serious )?relationship)|beautiful (smile|profile)|hello dear|hi dear|my dear)\b/i),
  },
  {
    label: 'Contains a link',
    weight: 5,
    test: phrase(/(https?:\/\/|www\.|\b[a-z0-9-]+\.(ly|io|xyz|top|click|link|site|online)\b)/i),
  },
  {
    label: 'Low-effort opener only',
    weight: 20,
    test: phrase(/^\s*(hi+|hello+|hey+|hii+|hello dear|hi there|how are you( doing)?( today)?|good (morning|evening|day))\W*$/i),
  },
  {
    label: 'Handle ends in a digit string',
    weight: 30,
    test: (input) => /\d{5,}$/.test(input.handle),
  },
  {
    label: 'Random-looking handle',
    weight: 15,
    test: (input) => /^[A-Za-z]+\d{3,4}$|^[a-z]{2,}_[a-z0-9]{6,}$/.test(input.handle) && !/\d{5,}$/.test(input.handle),
  },
  {
    label: 'Very few followers',
    weight: 15,
    test: (input) => input.followers !== undefined && input.followers < 25,
  },
  {
    label: 'Bait words in display name',
    weight: 25,
    test: (input) =>
      /(crypto|nft|forex|trader|invest|profit|coach|manager|promo|agency|official|support|💰|📈|🚀)/i.test(input.displayName),
  },
  {
    label: 'Impersonates support',
    weight: 30,
    test: phrase(/\b(your account (has been|will be) (suspended|restricted|flagged)|verify your account|copyright (violation|infringement)|appeal (form|here))\b/i),
  },
];

function run(rules: Rule[], input: RequestInput): Score {
  const signals = rules.filter((rule) => rule.test(input)).map(({ label, weight }) => ({ label, weight }));
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0));
  const verdict: Verdict = score >= 50 ? 'likely' : score >= 25 ? 'suspicious' : 'clean';
  return { score, verdict, signals };
}

// Pangram's verdict replaces the heuristic AI verdict; the heuristic reasons stay visible.
export interface PangramResult {
  prediction: 'AI' | 'Mixed' | 'Human';
  fractionAi: number;
  fractionAiAssisted: number;
  headline: string;
}

export function withPangram(heuristic: Score, pangram: PangramResult): Score {
  const score = Math.round(Math.min(1, pangram.fractionAi + pangram.fractionAiAssisted / 2) * 100);
  const verdict: Verdict = pangram.prediction === 'AI' ? 'likely' : pangram.prediction === 'Mixed' ? 'suspicious' : 'clean';
  return {
    score,
    verdict,
    signals: [{ label: `Pangram: ${pangram.headline || pangram.prediction} (${score}% AI)`, weight: score }, ...heuristic.signals],
  };
}

export function assess(input: RequestInput): Assessment {
  const normalized: RequestInput = {
    ...input,
    displayName: input.displayName.trim(),
    handle: input.handle.replace(/^@/, '').trim(),
    text: input.text.trim(),
  };
  return { ai: run(AI_RULES, normalized), spam: run(SPAM_RULES, normalized) };
}
