const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../student-app/node_modules/typescript');
const root = path.join(__dirname, '..');

function load(relative, mocks = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(js, { exports, require(id) {
    if (id === 'react/jsx-runtime') return require('../student-app/node_modules/react/jsx-runtime');
    if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`);
    return mocks[id];
  } });
  return exports;
}

const features = load('student-app/constants/studentFeatures.ts');
const translations = load('student-app/i18n/translations.ts').translations;
const { theme } = load('student-app/constants/theme.ts');

test('only Russian course sections are hidden; English stays unchanged', () => {
  for (const key of ['bonusLessons', 'library']) {
    assert.equal(features.studentFeaturesForCourse('russian')[key], false);
    assert.equal(features.studentFeaturesForCourse('english')[key], true);
  }
});

for (const section of ['library', 'speaking', 'podcasts', 'books', 'pronunciation']) {
  test(`Russian library bookmark ${section} redirects without deleting content`, () => {
    const segments = ['(tabs)', 'resources', section, '[id]'];
    assert.equal(features.hiddenStudentSectionRedirect('russian', segments), '/resources');
    assert.equal(features.hiddenStudentSectionRedirect('english', segments), null);
  });
}

test('bonus list, bonus details and legacy exercise links are hidden', () => {
  for (const [segments, id] of [
    [['(tabs)', 'homework', 'bonus'], undefined],
    [['(tabs)', 'homework', 'bonusLesson', '[bonusId]'], undefined],
    [['(tabs)', 'homework', 'lesson', '[lessonId]', 'video'], 'bonus-1'],
    [['homework', 'lesson', '[lessonId]', 'homework', '[part]'], ['bonus-18']],
  ]) {
    assert.equal(features.hiddenStudentSectionRedirect('russian', segments, id), '/homework');
    assert.equal(features.hiddenStudentSectionRedirect('english', segments, id), null);
  }
});

test('main lessons, exams, games and unrelated pages remain accessible', () => {
  for (const segments of [[], ['(tabs)', 'resources'], ['resources', 'games'],
    ['homework', 'roadmap', '[courseId]'], ['homework', 'exams'],
    ['homework', 'lesson', '[lessonId]'], ['profile', 'books'], ['community']]) {
    assert.equal(features.hiddenStudentSectionRedirect('russian', segments, 'lesson-1'), null);
  }
});

const reactHooks = {
  useState: value => [value, () => {}], useEffect() {}, useRef: value => ({ current: value }),
};

test('resources render neither library card nor info text for Russian in either UI language', () => {
  const native = {
    Animated: { Value: class { interpolate() { return 0; } }, View: 'AnimatedView' },
    Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View',
    StyleSheet: { create: value => value, absoluteFill: {} },
  };
  function texts(node) {
    if (typeof node === 'string') return [node];
    if (Array.isArray(node)) return node.flatMap(texts);
    return node?.props ? texts(node.props.children) : [];
  }
  for (const lang of ['uz', 'ru']) for (const courseLang of ['russian', 'english']) {
    const screen = load('student-app/app/(tabs)/resources/index.tsx', {
      'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
      'expo-router': { router: { push() {} } }, react: reactHooks,
      'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@/constants/theme': { theme }, '@/constants/studentFeatures': features,
      '@/i18n/LanguageContext': { useLang: () => ({ lang, courseLang, t: key => translations[lang][key] }),
        localizeCourseWording: text => text },
    }).default;
    const rendered = texts(screen());
    assert.equal(rendered.includes(translations[lang].res_hub_library_title), courseLang === 'english');
    assert.ok(rendered.includes(translations[lang].res_hub_games_title));
    assert.ok(rendered.includes(translations[lang].res_hub_community_title));
    assert.equal(rendered.includes(translations[lang].res_hub_info_library_desc), courseLang === 'english');
  }
});

test('both layouts redirect hidden pages before rendering their child navigators', () => {
  for (const [file, segments, target] of [
    ['resources', ['resources', 'books', '[storyId]'], '/resources'],
    ['homework', ['homework', 'bonus'], '/homework'],
  ]) {
    for (const courseLang of ['russian', 'english']) {
      const screen = load(`student-app/app/(tabs)/${file}/_layout.tsx`, {
        'expo-router': { Stack: Object.assign('Stack', { Screen: 'Screen' }), Redirect: 'Redirect',
          useSegments: () => segments, useGlobalSearchParams: () => ({}) },
        '@/constants/studentFeatures': features,
        '@/i18n/LanguageContext': { useLang: () => ({ courseLang }) },
      }).default;
      const result = screen();
      if (courseLang === 'russian') {
        assert.equal(result.type, 'Redirect');
        assert.equal(result.props.href, target);
      } else assert.notEqual(result.type, 'Redirect');
    }
  }
});

test('roadmap button and info use the same course-specific bonus flag', () => {
  const source = fs.readFileSync(path.join(root, 'student-app/app/(tabs)/homework/roadmap/[courseId].tsx'), 'utf8');
  assert.match(source, /studentFeaturesForCourse\(courseLang\)/);
  assert.match(source, /showBonusLessons && <Pressable style=\{ss\.bonusBtn\}/);
  assert.match(source, /showBonusLessons \? 'roadmap_course_dialog_body' : 'roadmap_course_dialog_body_no_bonus'/);
  for (const lang of ['uz', 'ru']) {
    assert.doesNotMatch(translations[lang].roadmap_course_dialog_body_no_bonus, /bonus|бонус|18/i);
    assert.match(translations[lang].roadmap_course_dialog_body, /18/);
  }
});

test('Russian course is selected before the first authenticated provider render', () => {
  let value;
  const react = { ...reactHooks, createContext: () => ({ Provider: 'Provider' }),
    useCallback: fn => fn, useContext() {} };
  const provider = load('student-app/i18n/LanguageContext.tsx', {
    '@react-native-async-storage/async-storage': {}, react,
    'react-native': { Platform: { OS: 'web' } },
    '@/services/contentApi': { fetchDemoStudentProfile() {} },
    '@/services/studentAuthStore': { useAuth: () => ({ token: 'fixture-token', student: { lang: 'russian' } }), getToken: () => 'fixture-token' },
    './translations': { translations },
  }).LanguageProvider;
  value = provider({ children: null }).props.value;
  assert.equal(value.courseLang, 'russian');
  assert.equal(features.studentFeaturesForCourse(value.courseLang).library, false);
});
