const express=require('express')
const router=express.Router()

const {signup,login,testUser}=require('../controllers/user_controller')
const {
    createJob,
    getJob,
    getJobs,
    cancelJob,
    retryJob
} = require("../controllers/job_controller");
const auth = require("../services/auth");
const rateLimiter = require("../services/rateLimiter")


router.post('/job/new',auth,rateLimiter(10, 60),createJob)

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
router.get(
    "/jobs",
    auth,
    getJobs
);
router.put(
    "/job/retry/:jobId",
    auth,
    rateLimiter(10, 60),
    retryJob
);

router.post('/user/signup',signup)
router.post('/user/login',login)
router.post('/user/test',testUser)

module. exports={
    router
}