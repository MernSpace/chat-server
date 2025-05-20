const mongoose = require('mongoose');

const messageSchema =  mongoose.Schema({
    chatId: { type: String, required: true },
    senderId: { type: String, required: true },
    text: { type: String, required: true },
},{timestamps: true,versionKey: false});

const messageModel = mongoose.model('Messages', messageSchema);

module.exports = messageModel