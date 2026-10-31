import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as english from '@zxcvbn-ts/language-en';
const checker = new ZxcvbnFactory({ translations: english.translations, graphs: common.adjacencyGraphs, dictionary: { ...common.dictionary, ...english.dictionary } });
export function checkStrength(password: string) {
  const result = checker.check(password.slice(0, 128));
  return { score: result.score, warning: result.feedback.warning ?? '', suggestions: result.feedback.suggestions };
}
