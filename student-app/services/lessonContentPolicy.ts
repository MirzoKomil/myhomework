import type { HomeworkPart } from '@/data/lessonContent';

export function supportedHomeworkParts(parts: HomeworkPart[]): HomeworkPart[] {
  return parts.filter(part => part.kind !== 'pronunciation'
    && !/talaffuz\s*mashq|pronunciation\s*check/i.test(part.title));
}

export function allowedVideoUrl(url?: string): string | undefined {
  if (!url) return undefined;
  // Defense in depth for old server responses during the rollout.
  if (/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/)8JMOD5WsBDM(?:[?&#/]|$)/.test(url)) return undefined;
  return url;
}
