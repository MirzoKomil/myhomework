'use strict';
// Eski (faqat rus tili) marketing endpointi. Endi ikkala til uchun yagona
// /api/target-ads ishlatiladi; bu yerga kelgan so'rov eski ochiq qolgan
// sahifadan — ma'lumot eski jadvalga yozilib yo'qolmasligi uchun rad etiladi.
const express=require('express');
module.exports=({authRequired})=>{
    const router=express.Router();router.use(authRequired);
    router.all('/',(req,res)=>res.status(410).json({error:'Sahifani yangilang (Ctrl + F5): Target monitoringi yangilandi'}));
    return router;
};
