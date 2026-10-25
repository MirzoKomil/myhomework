'use strict';
// Serverda yuz tekshiruvi — tashqi npm paketsiz.
// vendor/face-api/face-api.js (vladmandic/face-api 1.7.15, MIT) brauzer to'plami
// Node'da tfjs "cpu" backend bilan ishga tushiriladi; modellar diskdan o'qiladi.
// Sekin (1 rasm ~1-3 s), lekin kuniga bir necha o'nlab belgilash uchun yetarli.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { decodePng } = require('./png');

const VENDOR_DIR = path.join(__dirname, '..', '..', '..', 'vendor', 'face-api');
const MODEL_DIR = path.join(VENDOR_DIR, 'model');

// Bir xil odam: descriptorlar orasidagi Evklid masofasi shu chegaradan kichik.
// face-api tavsiyasi 0.6; xodim almashtirib yuborilmasligi uchun qattiqroq.
const MATCH_THRESHOLD = Number(process.env.STAFF_FACE_THRESHOLD || 0.5);

let loading = null;
let queue = Promise.resolve();

function loadFaceApi() {
    if (loading) return loading;
    loading = (async () => {
        let code = fs.readFileSync(path.join(VENDOR_DIR, 'face-api.js'), 'utf8');
        // Brauzer to'plamida Node'ning "util" moduli bo'sh stub bilan almashtirilgan;
        // tfjs Node platformasi TextEncoder uchun unga murojaat qiladi.
        const STUB = 'BR=Vt(()=>{})';
        if (!code.includes(STUB)) throw new Error('face-api to\'plami kutilgan versiya emas');
        code = code.replace(STUB, 'BR=()=>require("util")');
        const sandbox = { require, process, console, setTimeout, clearTimeout, setInterval, clearInterval,
            TextEncoder, TextDecoder, URL, Buffer, performance: globalThis.performance,
            fetch: async (url) => {
                // Modellar faqat vendor/face-api/model ichidan o'qiladi.
                const name = path.basename(String(url).split('?')[0]);
                const file = path.join(MODEL_DIR, name);
                if (!file.startsWith(MODEL_DIR) || !fs.existsSync(file)) {
                    return { ok: false, status: 404, statusText: 'not found' };
                }
                const buf = fs.readFileSync(file);
                return { ok: true, status: 200, headers: { get: () => null },
                    json: async () => JSON.parse(buf.toString('utf8')),
                    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
            } };
        sandbox.globalThis = sandbox;
        sandbox.self = sandbox;
        sandbox.global = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(code + ';globalThis.faceapi=faceapi;', sandbox, { filename: 'face-api.js' });
        const faceapi = sandbox.faceapi;
        // Rasmlar to'g'ridan-to'g'ri tensor ko'rinishida beriladi, canvas kerak emas.
        // face-api muhit obyektini so'raydi — DOM'siz minimal muhit beramiz.
        class Noop {}
        faceapi.env.setEnv({
            Canvas: Noop, CanvasRenderingContext2D: Noop, Image: Noop, ImageData: Noop, Video: Noop,
            createCanvasElement: () => { throw new Error('canvas yo\'q'); },
            createImageElement: () => { throw new Error('image yo\'q'); },
            createVideoElement: () => { throw new Error('video yo\'q'); },
            fetch: sandbox.fetch,
            readFile: async (p) => fs.readFileSync(path.join(MODEL_DIR, path.basename(p))),
        });
        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();
        await faceapi.nets.tinyFaceDetector.loadFromUri('/model');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/model');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/model');
        return faceapi;
    })();
    loading.catch(() => { loading = null; });
    return loading;
}

// Bosh qanchalik burilgan: burun uchining ko'zlar o'rtasidan siljishi /
// ko'zlar orasidagi masofa. ~0 — to'g'ri, ±0.15 dan katta — sezilarli burilgan.
function yawOf(landmarks) {
    const pts = landmarks.positions;
    const avg = (from, to) => {
        let x = 0, y = 0;
        for (let i = from; i <= to; i++) { x += pts[i].x; y += pts[i].y; }
        const n = to - from + 1; return { x: x / n, y: y / n };
    };
    const leftEye = avg(36, 41), rightEye = avg(42, 47), nose = pts[30];
    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y) || 1;
    return (nose.x - (leftEye.x + rightEye.x) / 2) / eyeDist;
}

// PNG buffer → { faces, descriptor?: number[128], yaw, score, box }.
// opts.descriptor=false — faqat yuz va bosh burilishi (tirik ekanini tekshirish kadri uchun, tezroq).
async function analyze(pngBuffer, opts = {}) {
    const faceapi = await loadFaceApi();
    const withDescriptor = opts.descriptor !== false;
    const run = queue.then(async () => {
        const { width, height, rgb } = decodePng(pngBuffer);
        const input = faceapi.tf.tensor3d(rgb, [height, width, 3], 'int32');
        try {
            // 320 — aniqlik va tezlik muvozanati (CPU'da ~2-3 s).
            const det = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
            let q = faceapi.detectAllFaces(input, det).withFaceLandmarks();
            if (withDescriptor) q = q.withFaceDescriptors();
            const all = await q;
            if (!all.length) return { faces: 0 };
            const best = all.reduce((x, y) => (y.detection.box.area > x.detection.box.area ? y : x));
            const box = best.detection.box;
            return { faces: all.length,
                descriptor: withDescriptor ? Array.from(best.descriptor) : undefined,
                yaw: yawOf(best.landmarks), score: best.detection.score,
                box: { x: box.x, y: box.y, width: box.width, height: box.height },
                imageWidth: width, imageHeight: height };
        } finally {
            input.dispose();
        }
    });
    queue = run.catch(() => {}); // bir vaqtda faqat bitta rasm (CPU'ni bo'g'maslik uchun)
    return run;
}

function distance(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Infinity;
    let s = 0;
    for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s);
}

// Namuna descriptorlari ichidan eng yaqinini topadi.
function bestDistance(descriptor, references) {
    let best = Infinity;
    for (const r of references || []) best = Math.min(best, distance(descriptor, r));
    return best;
}

module.exports = { analyze, distance, bestDistance, yawOf, loadFaceApi, MATCH_THRESHOLD };
