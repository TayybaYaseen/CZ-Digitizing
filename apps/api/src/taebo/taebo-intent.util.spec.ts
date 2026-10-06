import { detectSmallTalk } from './taebo-intent.util';

describe('detectSmallTalk', () => {
  it.each([
    ['hi', 'hello'],
    ['Hello Taebo!', 'hello'],
    ['good morning', 'hello'],
    ['Assalamualaikum', 'hello'],
    ['السلام علیکم', 'hello'],
    ['thanks so much', 'thanks'],
    ['ok thank you', 'thanks'],
    ['شکریہ', 'thanks'],
    ['yes', 'ack'],
    ['no', 'ack'],
    ['ok', 'ack'],
    ['help', 'help'],
    ['can you help me please', 'help'],
    ['I need help', 'help'],
  ])('%p -> %p', (message, expected) => {
    expect(detectSmallTalk(message)).toBe(expected);
  });

  // Anything with a real content word is a question for the matcher, not small talk.
  it.each(['hi, what formats do you have?', 'help me with my order', 'yes I need a DST file', 'how much?', 'price?', 'logo?', ''])(
    '%p is not small talk',
    (message) => {
      expect(detectSmallTalk(message)).toBeNull();
    },
  );
});
