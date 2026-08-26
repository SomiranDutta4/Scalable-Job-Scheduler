const express=require('express')
const router=express.Router

const {signup,login}=require('../controllers/user_controller')

router.post('/job/new')
router.get('/job/status/')
router.put('/job/cancel')
router.put('/job/retry')

router.post('/user/signup',signup)
router.post('/user/login',login)

module. exports={
    router
}