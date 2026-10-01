import { Redirect } from 'expo-router';

// Redirect old bookmarks without exposing the removed exercise.
export default function RemovedPronunciationScreen() {
  return <Redirect href="/resources/library" />;
}
