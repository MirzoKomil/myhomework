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
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Myhomework.uz API', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/leads', leadsRoutes);

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

app.listen(PORT, () => {
    console.log(`Myhomework.uz server: http://localhost:${PORT}`);
    console.log(`API health: http://localhost:${PORT}/api/health`);
});
