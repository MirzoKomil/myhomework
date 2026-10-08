import type { CourseLang } from '@/i18n/LanguageContext';

// Temporary Domwork rollout switches. Re-enable these once Russian materials
// are ready; hiding a section never deletes its content or student progress.
const RUSSIAN_FEATURES = { bonusLessons: false, library: false } as const;
const ENGLISH_FEATURES = { bonusLessons: true, library: true } as const;

export function studentFeaturesForCourse(courseLang: CourseLang) {
  return courseLang === 'russian' ? RUSSIAN_FEATURES : ENGLISH_FEATURES;
}

export function hiddenStudentSectionRedirect(
  courseLang: CourseLang,
  segments: readonly string[],
  lessonId?: string | string[],
): '/homework' | '/resources' | null {
  const features = studentFeaturesForCourse(courseLang);
  const homeworkIndex = segments.indexOf('homework');
  const homeworkSection = segments[homeworkIndex + 1];
  const id = Array.isArray(lessonId) ? lessonId[0] : lessonId;
  if (!features.bonusLessons && homeworkIndex >= 0 && (
    homeworkSection === 'bonus' || homeworkSection === 'bonusLesson' ||
    (homeworkSection === 'lesson' && id?.startsWith('bonus-'))
  )) return '/homework';

  const resourcesIndex = segments.indexOf('resources');
  const resourcesSection = segments[resourcesIndex + 1];
  // Speaking, podcasts and books are children linked from the library hub.
  if (!features.library && resourcesIndex >= 0 &&
    ['library', 'speaking', 'podcasts', 'books', 'pronunciation'].includes(resourcesSection)) {
    return '/resources';
  }
  return null;
}
