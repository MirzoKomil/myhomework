'use strict';
const express=require('express');
const link=require('../services/domworkBot/studentLink');
module.exports=function({pool,runtime,authRequired}){
    const router=express.Router();
    router.use((req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');next();});
    router.use(authRequired);
    const handle=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(error){
        if(!error.status)console.error('[student-telegram]',error.code||error.name);
        res.status(error.status||500).json({error:error.status?error.message:'Telegram ulanishida xatolik'});
    }};
    router.get('/',handle(async req=>{
        const st=await link.status(pool,req.user);
        // Majburiy oyna: kampaniya yoqilgan, o'quvchi ulanmagan va bot haqiqatan xabar qabul qilyapti (aks holda ilova bloklanmaydi).
        const mandatory=await require('../services/domworkBot/studentActivation').mandatory(pool,st.linked)
            && (runtime.healthy?await runtime.healthy():runtime.status().state==='ready');
        return {...st,available:runtime.status().state==='ready',mandatory};
    }));
    router.post('/',handle(req=>{
        if(runtime.status().state!=='ready')throw Object.assign(Error('Bot hozir tayyor emas. Keyinroq urinib ko‘ring'),{status:503});
        return link.create(pool,req.user);
    }));
    router.post('/confirm',handle(req=>link.confirm(pool,req.user,req.body)));
    router.post('/cancel',handle(req=>link.cancel(pool,req.user,req.body)));
    return router;
};
