'use strict';
// QR kodni serverda SVG "path" ko'rinishida chizadi (CRM va student app bir xil formatni chizadi:
// har bir qora katak "Mx yh1v1h-1z"). Brauzer/ilovaga alohida QR kutubxona kerak emas.
const qrcode = require('qrcode-generator');
function qrPath(text) {
    const qr = qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    const size = qr.getModuleCount();
    let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { size, path: d };
}
module.exports = { qrPath };
