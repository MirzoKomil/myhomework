'use strict';
const express=require('express');
const insights=require('../services/domworkBot/insights');
const queue=require('../services/domworkBot/queue');
module.exports=({pool,authRequired})=>{
    const router=express.Router();router.use(authRequired);router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
    router.get('/',async(req,res)=>{try{res.json(await insights.marketingMonth(pool,req.user,req.query.month));}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Marketing ma’lumotlarini yuklashda xatolik'});}});
    router.put('/',async(req,res)=>{try{res.json(await queue.transaction(pool,db=>insights.saveMarketing(db,req.user,req.body||{})));}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Marketing ma’lumotlarini saqlashda xatolik'});}});
    return router;
};
