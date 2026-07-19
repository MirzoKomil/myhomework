const PDFDocument = require('pdfkit');
const { CONTRACT_TITLE, CONTRACT_PREAMBLE, CONTRACT_SECTIONS } = require('../data/contractTemplate');

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

module.exports = { generateContractPdfBuffer };
