// Local-only browser QA. Never connects to the production database.
const express = require('express');
const path = require('node:path');
const { sanitizeMobileContent } = require('../js/mobileContentPolicy');
const app = express();
app.use(express.json());
const progress = {};
function language(req) { return req.headers.authorization?.includes('russian') ? 'russian' : 'english'; }
app.post('/api/auth/student-login', (req, res) => {
  const lang = req.body.login === 'russian' ? 'russian' : 'english';
  res.json({ token: `preview-${lang}`, student: { id: `preview-${lang}`, name: 'Preview', lang } });
});
app.get('/api/state/mobile-content', (req, res) => {
  const lang = req.headers.authorization ? language(req) : (req.query.course || 'english');
  res.json(sanitizeMobileContent({ courseLang: lang, courses: [{ id: lang, name: lang, lang }],
    lessons: Array.from({ length: 72 }, (_, i) => ({ id: `${lang}-${i + 1}`, name: `${i + 1}-dars`, courseId: lang })),
    modules: [], moduleContents: [], lessonContents: { [`${lang}-1`]: {
      konspekt: `${lang} authored lesson`, videoUrl: lang === 'english' ? 'https://youtu.be/8JMOD5WsBDM' : 'https://youtu.be/yTRiBmSrdh4',
      homeworkParts: [{ id: 'D', title: 'Talaffuz mashqi', kind: 'matching', pairs: [] },
        { id: 'g', title: 'Gramatika mashqi', kind: 'multipleChoice', questions: [{ id: 'q', question: 'Preview?', options: ['Yes', 'No'], correctIndex: 0 }] }] } },
    examContents: {}, library: { grammar: [], words: [], pronunciation: [], speaking: [], books: [], podcasts: [] }, shop: [] }));
});
app.get('/api/state/lesson-progress', (req, res) => res.json({ progress: progress[language(req)] || {} }));
app.post('/api/state/lesson-progress', (req, res) => {
  const lang = language(req);
  progress[lang] = { ...progress[lang], ...req.body.progress };
  res.json({ progress: progress[lang] });
});
app.get('/__audit', (req, res) => res.json(progress));
app.get('/api/state/demo-profile', (req, res) => res.json({ id: `preview-${language(req)}`, name: 'Preview', lang: language(req) }));
app.get('/api/state/demo-grades', (req, res) => res.json({ grades: [] }));
app.get('/api/state/demo-schedule', (req, res) => res.json({ startsAt: null, telegramGroupLink: '' }));
app.get('/api/*', (req, res) => res.json({}));
const dist = path.join(__dirname, '..', 'student-app', 'dist');
app.use('/student', express.static(dist));
app.get('/student/*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
app.listen(4173, '127.0.0.1', () => console.log('Local fixture preview: http://127.0.0.1:4173/student/'));
