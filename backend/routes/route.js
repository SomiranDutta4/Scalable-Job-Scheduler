const express=require('express')
const router=express.Router()

const {signup,login}=require('../controllers/user_controller')
const {createJob, getJob,cancelJob,retryJob} =require('../controllers/job_controller')
const auth = require("../services/auth");
const rateLimiter = require("../services/rateLimiter")


router.post('/job/new',rateLimiter(10, 60),createJob)
router.get(
    "/job/status/:jobId",
    auth,
    getJob
);

router.put(
    "/job/cancel/:jobId",
    auth,
    cancelJob
);

router.put(
    "/job/retry/:jobId",
    auth,
    rateLimiter(10, 60),
    retryJob
);

router.post('/user/signup',signup)
router.post('/user/login',login)

module. exports={
    router
}