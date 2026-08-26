const express=require('express')
const router=express.Router

const {signup,login}=require('../controllers/user_controller')
const {createJob, getJob,cancelJob,retryJob} =require('../controllers/job_controller')
const {auth}=require('../services/auth')

router.post('/job/new',auth,createJob)
router.get('/job/status/',auth,getJob)
router.put('/job/cancel',auth,cancelJob)
router.put('/job/retry',auth,retryJob)

router.post('/user/signup',signup)
router.post('/user/login',login)

module. exports={
    router
}