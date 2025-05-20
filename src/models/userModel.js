const mongoose = require('mongoose');
const userSchema = mongoose.Schema({
    username: {type:String,required:true},
    password: {type:String, required:true},
    email: {type:String, required:true,unique:true},
    phone: {type:String, required:true},
},{timeStamp:true,versionKey:false})


const userModel = mongoose.model('users',userSchema)

module.exports = userModel