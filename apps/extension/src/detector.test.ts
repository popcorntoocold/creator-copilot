import { assess, withPangram } from './detector';
import { parseRowText } from './parse';

describe('assess', () => {
  it('flags a templated AI outreach message', () => {
    const result = assess({
      displayName: 'Jordan Blake',
      handle: 'jordanblake',
      text: "Hi! I hope this message finds you well. I came across your profile and your content is truly inspiring. I'd love to explore a potential collaboration — let me know if you're open to it — looking forward to hearing from you!",
    });
    expect(result.ai.verdict).toBe('likely');
  });

  it('flags a crypto spam account', () => {
    const result = assess({
      displayName: 'Crypto Coach Anna 📈',
      handle: 'anna48213907',
      text: 'Hello dear, I can show you how to make daily profit with bitcoin trading. Message me on telegram',
    });
    expect(result.spam.verdict).toBe('likely');
    expect(result.spam.signals.map((s) => s.label)).toContain('Handle ends in a digit string');
  });

  it('flags a bare opener from a numbered handle as spam', () => {
    expect(assess({ displayName: 'Emily', handle: '@Emily9920184', text: 'Hi' }).spam.verdict).toBe('likely');
  });

  it('leaves a normal casual message alone', () => {
    const result = assess({
      displayName: 'Sam',
      handle: 'samcodes',
      text: 'yo saw your thread on vite plugins, ngl the crx one saved me a ton of time. got a sec to look at a bug?',
    });
    expect(result.ai.verdict).toBe('clean');
    expect(result.spam.verdict).toBe('clean');
  });
});

describe('followers', () => {
  it('flags a romance opener from a near-empty account', () => {
    const result = assess({ displayName: 'Emily Rose', handle: '', text: 'Hello dear how are you', followers: 3 });
    expect(result.spam.verdict).toBe('likely');
    expect(result.spam.signals.map((s) => s.label)).toContain('Very few followers');
  });
});

describe('withPangram', () => {
  it("lets Pangram's verdict override the heuristic AI verdict", () => {
    const heuristic = assess({ displayName: 'Sam', handle: 'samcodes', text: 'quick q about your post' }).ai;
    const result = withPangram(heuristic, { prediction: 'AI', fractionAi: 0.9, fractionAiAssisted: 0.1, headline: 'AI Detected' });
    expect(result.verdict).toBe('likely');
    expect(result.score).toBe(95);
    expect(result.signals[0]?.label).toBe('Pangram: AI Detected (95% AI)');
  });

  it('clears the AI flag when Pangram says human', () => {
    const heuristic = assess({ displayName: 'J', handle: 'j', text: 'I hope this message finds you well. I would love to connect.' }).ai;
    expect(withPangram(heuristic, { prediction: 'Human', fractionAi: 0, fractionAiAssisted: 0, headline: 'Human' }).verdict).toBe('clean');
  });
});

describe('parseRowText', () => {
  it('extracts name, handle, and preview from a DM row', () => {
    expect(parseRowText('Emily Rose\n@Emily9920184\n·\n2h\nHello dear how are you')).toEqual({
      displayName: 'Emily Rose',
      handle: 'Emily9920184',
      text: 'Hello dear how are you',
    });
  });

  it('ignores legacy links without a handle', () => {
    expect(parseRowText('Message requests\n3 pending', { requireHandle: true })).toBeNull();
  });

  it('parses an XChat request row (no handle, follower count)', () => {
    expect(parseRowText('Emily Rose\n2h\nHello dear how are you\n12 Followers')).toEqual({
      displayName: 'Emily Rose',
      handle: '',
      text: 'Hello dear how are you',
      followers: 12,
    });
  });

  it('takes the handle from an XChat inbox aria-description', () => {
    const row = parseRowText('Sam\n53m\nyo', { description: 'Sam, @samcodes, yo, 53m' });
    expect(row?.handle).toBe('samcodes');
  });

  it('ignores the preview when the viewer sent the last message', () => {
    expect(parseRowText('Sam\n1.2K Followers\n3d\nYou: sounds good')?.text).toBe('');
    expect(parseRowText('Sam\n1.2K Followers\n3d\nYou: sounds good')?.followers).toBe(1200);
  });
});
