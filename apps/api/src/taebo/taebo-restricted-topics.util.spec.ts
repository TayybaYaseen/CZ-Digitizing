import { isRestrictedTopic } from './taebo-restricted-topics.util';

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-4 — payment/price/order-status/file-availability
// questions must always escalate, never be matched against an FAQ.
describe('isRestrictedTopic', () => {
  it.each([
    'Has my payment gone through?',
    'How much does this design cost?',
    'Can I get a refund?',
    'What is the status of my order?',
    'Where is my order, when will it arrive?',
    'Is my file ready to download?',
    'Are my files available yet?',
  ])('flags %p as restricted', (question) => {
    expect(isRestrictedTopic(question)).toBe(true);
  });

  it.each([
    'What file formats do you support?',
    'How do I choose a design size?',
    'Do you offer custom embroidery digitizing?',
  ])('does not flag %p as restricted', (question) => {
    expect(isRestrictedTopic(question)).toBe(false);
  });
});
