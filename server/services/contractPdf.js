const PDFDocument = require('pdfkit');
const { CONTRACT_TITLE, CONTRACT_PREAMBLE, CONTRACT_SECTIONS } = require('../data/contractTemplate');
const { CONTRACT_TITLE_RU, CONTRACT_SECTIONS_RU } = require('../data/contractTemplateRussian');

const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function formatContractDateUz(isoDate) {
    const d = isoDate ? new Date(isoDate) : new Date();
    return `"${d.getDate()}" ${MONTHS_UZ[d.getMonth()]} ${d.getFullYear()} yil`;
}

// 6-vazifa: lid to'lov jarayonida o'quvchiga aylanganda avtomatik tuziladigan
// mijoz shartnomasi — namuna PDF matnini pdfkit orqali qayta generatsiya
// qiladi, Buyurtmachi ismi va shartnoma raqami/sanasi joyiga qo'yiladi.
function generateContractPdfBuffer({ contractNumber, studentFullName, contractDate }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 56 });
            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.font('Helvetica-Bold').fontSize(13).text(CONTRACT_TITLE, { align: 'center' });
            doc.moveDown(1);

            doc.font('Helvetica').fontSize(11);
            doc.text(`Shartnoma raqami: ${contractNumber}`);
            doc.text('Tuzilgan joyi: Andijon shahri');
            doc.text(`Sana: ${formatContractDateUz(contractDate)}`);
            doc.moveDown(0.5);

            doc.text(
                `Bajaruvchi: "Homework" MCHJ (keyingi o'rinlarda "Bajaruvchi" deb yuritiladi), va Buyurtmachi: ${studentFullName} keyingi o'rinlarda "Buyurtmachi" deb ataluvchi shaxs quyidagilar haqida o'zaro kelishuvga erishdi:`,
                { align: 'justify' }
            );
            doc.moveDown(0.5);

            CONTRACT_PREAMBLE.forEach(p => {
                doc.text(p, { align: 'justify' });
                doc.moveDown(0.5);
            });

            CONTRACT_SECTIONS.forEach(section => {
                doc.moveDown(0.3);
                doc.font('Helvetica-Bold').fontSize(11).text(section.heading);
                doc.moveDown(0.2);
                doc.font('Helvetica').fontSize(11);
                section.paragraphs.forEach(p => {
                    doc.text(p, { align: 'justify' });
                    doc.moveDown(0.4);
                });
            });

            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').fontSize(11).text('TOMONLAR IMZOSI');
            doc.moveDown(0.3);
            doc.font('Helvetica').fontSize(11);
            doc.text('Bajaruvchi: "Homework" MCHJ.');
            doc.moveDown(0.5);
            doc.text(`Buyurtmachi: ${studentFullName}`);
            doc.moveDown(0.2);
            doc.font('Helvetica-Oblique').fontSize(9).text(
                "(9.3-bandga muvofiq elektron shaklda tuzilgan va tasdiqlangan, qog'oz imzo shart emas)"
            );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// 14-vazifa: 15/30/60 daqiqalik dars davomiyligi CRM'dagi haqiqiy
// "lessonDuration" qiymati — bu 4.1-banddagi Start/Standard/VIP tariflarga
// aynan mos keladi (js/app.js'dagi SALARY_RATES bilan bir xil uchlik).
function tariffLabelForDuration(lessonDuration) {
    if (lessonDuration === 30) return 'Standard';
    if (lessonDuration === 60) return 'VIP';
    return 'Start';
}

// "Domwork" (rus tili) kursi uchun yangi shartnoma — faqat rus tili
// kursidagi o'quvchilarga ko'rsatiladi (getStudentContractPdf orqali kurs
// tiliga qarab tanlanadi). Yakunidagi "TOMONLARNING MA'LUMOTLARI" qismi
// haqiqiy Buyurtmachi ismi/telefoni/tarifi bilan avtomatik to'ldiriladi.
function generateRussianContractPdfBuffer({ contractNumber, studentFullName, studentPhone, lessonDuration, contractDate }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 56 });
            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.font('Helvetica-Bold').fontSize(13).text(CONTRACT_TITLE_RU, { align: 'center' });
            doc.moveDown(1);

            doc.font('Helvetica').fontSize(11);
            doc.text(`Shartnoma raqami: ${contractNumber}`);
            doc.text(`Sana: ${formatContractDateUz(contractDate)}`);
            doc.moveDown(0.5);

            doc.text(
                `Bajaruvchi: "Domwork" onlayn ta'lim loyihasi nomidan xizmat ko'rsatuvchi "Homework" MCHJ (keyingi o'rinlarda — "Bajaruvchi"), bir tarafdan, va Buyurtmachi: ${studentFullName} (keyingi o'rinlarda — "Buyurtmachi"), ikkinchi tarafdan, quyidagilar yuzasidan mazkur ommaviy oferta shartnomasini tuzdilar:`,
                { align: 'justify' }
            );
            doc.moveDown(0.5);

            CONTRACT_SECTIONS_RU.forEach(section => {
                doc.moveDown(0.3);
                doc.font('Helvetica-Bold').fontSize(11).text(section.heading);
                doc.moveDown(0.2);
                doc.font('Helvetica').fontSize(11);
                section.paragraphs.forEach(p => {
                    doc.text(p, { align: 'justify' });
                    doc.moveDown(0.4);
                });
            });

            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').fontSize(11).text('TOMONLARNING MA\'LUMOTLARI');
            doc.moveDown(0.3);
            doc.font('Helvetica').fontSize(11);
            doc.text('Bajaruvchi: "Homework" MCHJ (Ta\'lim loyihasi: "Domwork")');
            doc.text('To\'lov tizimlaridagi identifikator: "Homework" (Click / Payme)');
            doc.text('Muddatli to\'lov hamkorlari: Uzum Nasiya, PayLater');
            doc.moveDown(0.5);
            doc.text(`Buyurtmachi F.I.SH.: ${studentFullName}`);
            doc.text(`Telefon raqami: ${studentPhone || '—'}`);
            doc.text(`Tanlangan tarif: ${tariffLabelForDuration(lessonDuration)}`);
            doc.moveDown(0.2);
            doc.font('Helvetica-Oblique').fontSize(9).text(
                "(1.3-bandga muvofiq elektron shaklda tuzilgan va aksept qilingan, qog'oz imzo shart emas)"
            );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateContractPdfBuffer, generateRussianContractPdfBuffer };
