/** Audiohikoyalar uchun umumiy qiymatlar (StoryList va Book). */
import type { BookLevel, BookStory } from '@/data/bookStories';

import { readMinutes } from './shared';

// Dizayndagi daraja yorliqlari (Qiyin — dizayndagidek binafsha matn).
export const LEVEL_CHIP: Record<BookLevel, { label: string; bg: string; fg: string }> = {
  a1: { label: 'Oson', bg: '#E3F7EE', fg: '#075E3A' },
  a2: { label: 'Oʻrta', bg: '#F0EBFF', fg: '#5B2FD6' },
  b1: { label: 'Qiyin', bg: '#FDECEC', fg: '#5B2FD6' },
};

export const storyText = (s: BookStory) => s.paragraphs.map((p) => p.en).join(' ');
export const storyMinutes = (s: BookStory) => readMinutes(storyText(s));
