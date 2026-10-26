// Xodim holati va sotuv egasi — brauzer ham, server testlari ham ishlatadi.
//  * isActive: ishdan bo'shatilgan (yoki "Inactive") xodim lid taqsimotida,
//    reytingda va tanlov ro'yxatlarida ko'rinmasligi uchun yagona qoida.
//  * saleOwner: sotuv kimga yoziladi — server muhrlagan saleManagerId
//    (lid boshqa menejerga berilsa ham o'zgarmaydi), bo'lmasa hozirgi menejer.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.staffStatus = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function isActive(employee) {
        if (!employee) return false;
        if (employee.offboardedAt) return false;
        return String(employee.status || 'active').toLowerCase() !== 'inactive';
    }
    function saleOwner(lead) {
        return String((lead && (lead.saleManagerId || lead.managerId)) || '');
    }
    // Ro'yxatdan faqat faollarni qoldiradi; `keepId` berilsa (masalan lidning
    // hozirgi menejeri) u ham saqlanadi, toki tanlov maydoni bo'sh ko'rinmasin.
    function activeOnly(list, keepId) {
        return (list || []).filter(e => isActive(e) || (keepId && String(e.id) === String(keepId)));
    }
    function label(employee) {
        if (!employee) return '';
        return isActive(employee) ? employee.name : `${employee.name} (ishdan ketgan)`;
    }
    return { isActive, saleOwner, activeOnly, label };
}));
