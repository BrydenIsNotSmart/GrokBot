import type { ResponseFilterLevel } from "../database/schema/guilds";

// Word lists for filtering
const SLURS = [
  // Racial slurs
  'nigger', 'nigga', 'kike', 'spic', 'chink', 'gook', 'wetback', 'cracker',
  // Homophobic slurs
  'faggot', 'fag', 'dyke', 'tranny', 'shemale',
  // Sexist slurs
  'cunt', 'bitch', 'whore', 'slut',
  // Religious slurs
  'terrorist', 'infidel',
  // Disability slurs
  'retard', 'retarded',
].map(word => word.toLowerCase());

const CURSE_WORDS = [
  // Common curse words
  'fuck', 'shit', 'damn', 'hell', 'ass', 'asshole', 'bastard', 'bitch',
  'crap', 'piss', 'dick', 'cock', 'pussy', 'tits', 'twat', 'wanker',
  // Stronger curse words
  'motherfucker', 'son of a bitch', 'bullshit',
].map(word => word.toLowerCase());

// Additional variations and patterns
const WORD_VARIATIONS = {
  // Common leetspeak and variations
  'f': ['f', 'ph', 'ff'],
  'u': ['u', 'oo', 'ew'],
  'c': ['c', 'k', 'ck'],
  'k': ['k', 'c', 'ck'],
  's': ['s', 'z', '$'],
  'a': ['a', '@', '4'],
  'e': ['e', '3'],
  'i': ['i', 'l', '1', '!'],
  'o': ['o', '0'],
  't': ['t', '7'],
};

function createWordPattern(word: string): RegExp {
  let pattern = word.split('').map(char => {
    const variations = WORD_VARIATIONS[char.toLowerCase() as keyof typeof WORD_VARIATIONS];
    return variations ? `[${variations.join('')}]` : char;
  }).join('');
  
  // Add common separators and variations
  pattern = pattern.replace(/a/g, '[a@4]');
  pattern = pattern.replace(/e/g, '[e3]');
  pattern = pattern.replace(/i/g, '[i1l!]');
  pattern = pattern.replace(/o/g, '[o0]');
  pattern = pattern.replace(/s/g, '[s$z]');
  pattern = pattern.replace(/t/g, '[t7]');
  
  return new RegExp(`\\b${pattern}\\b`, 'gi');
}

// Pre-compile regex patterns for performance
const SLUR_PATTERNS = SLURS.map(createWordPattern);
const CURSE_WORD_PATTERNS = CURSE_WORDS.map(createWordPattern);

export function filterResponse(text: string, filterLevel: ResponseFilterLevel): string {
  if (filterLevel === 'none') {
    return text;
  }

  let filteredText = text;

  if (filterLevel === 'relaxed') {
    // Filter slurs only
    SLUR_PATTERNS.forEach(pattern => {
      filteredText = filteredText.replace(pattern, (match) => {
        return '*'.repeat(match.length);
      });
    });
  } else if (filterLevel === 'extreme') {
    // Filter both slurs and curse words
    const allPatterns = [...SLUR_PATTERNS, ...CURSE_WORD_PATTERNS];
    allPatterns.forEach(pattern => {
      filteredText = filteredText.replace(pattern, (match) => {
        return '*'.repeat(match.length);
      });
    });
  }

  return filteredText;
}

export function getFilterStats(text: string, filterLevel: ResponseFilterLevel): {
  originalLength: number;
  filteredLength: number;
  wordsFiltered: number;
} {
  const filtered = filterResponse(text, filterLevel);
  const wordsFiltered = (text.match(/\b\w+\b/g) || []).length - (filtered.match(/\b\w+\b/g) || []).length;
  
  return {
    originalLength: text.length,
    filteredLength: filtered.length,
    wordsFiltered,
  };
}
