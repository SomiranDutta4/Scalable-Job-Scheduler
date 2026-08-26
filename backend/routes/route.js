const express=require('express')
const router=express.Router

const {signup,login}=require('../controllers/user_controller')
const {createJob, getJob,cancelJob,retryJob} =require('../controllers/job_controller')
const {auth}=require('../services/auth')
const rateLimiter = require("../services/ratelimiter");


router.post('/job/new',rateLimiter(10, 60),createJob)
router.get('/job/status/',rateLimiter(10, 60),getJob)
router.put('/job/cancel',rateLimiter(10, 60),cancelJob)
router.put('/job/retry',rateLimiter(10, 60),retryJob)

// router.post('/user/signup',signup)
// router.post('/user/login',login)

module. exports={
    router
}