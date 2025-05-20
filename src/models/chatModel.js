const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
    {
        members: {
            type: Array,
            required: true
        },
        isGroup: {
            type: Boolean,
            default: false
        },
        groupName: {
            type: String,
            default: null
        },
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null
        },
        lastMessageTimestamp: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

// Create an index for faster chat lookups
chatSchema.index({ members: 1 });

const ChatModel = mongoose.model('Chat', chatSchema);

module.exports = ChatModel;