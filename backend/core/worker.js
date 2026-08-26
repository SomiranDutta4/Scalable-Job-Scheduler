const {connectRedis} = require("../config/redis")
const {getDB} = require("../config/db")

class worker{
    async start(){
        await connectRedis();
        console.log("worker started")
        this.processQueue();
    }
    async processQueue(){
        
    }
    async processDelayedJob() {

    }
    async processJob(){

    }
    async processFailure(){

    }
}

export const worker