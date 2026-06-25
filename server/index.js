require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const stateRoutes = require('./routes/state');
const leadsRoutes = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Myhomework.uz API', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/leads', leadsRoutes);

const studentWebDist = path.join(ROOT, 'student-app', 'dist');
app.use('/student', express.static(studentWebDist, {
    extensions: ['html'],
    index: 'index.html',
    redirect: false
}));
app.get(['/student', '/student/*'], (req, res, next) => {
    if (path.extname(req.path)) return next();
    res.sendFile(path.join(studentWebDist, 'index.html'), err => {
        if (err) res.status(404).send('O\'quvchi ilovasi topilmadi. Avval `npm run student:build` ishga tushiring.');
    });
});

app.use(express.static(ROOT, {
    index: false,
    extensions: ['html']
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'login.html'));
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API topilmadi' });
    }
    const file = path.join(ROOT, req.path.endsWith('.html') ? req.path : req.path + '.html');
    res.sendFile(file, err => {
        if (err) res.status(404).send('Sahifa topilmadi');
    });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server xatoligi' });
});

const { init } = require('./db');

init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Myhomework.uz server: port ${PORT}`);
        console.log(`API health: /api/health`);
    });
}).catch(err => {
    console.error('Server ishga tushmadi:', err.message);
    process.exit(1);
});
