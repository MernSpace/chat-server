const messageModel = require('../models/messageModel');
const chatModel = require('../models/chatModel');
const sanitize = require('mongo-sanitize');
const redis = require('../config/redis');

// Create a new message
const createMessage = async (req, res) => {
    try {
        // Sanitize inputs
        const chatId = sanitize(req.body.chatId);
        const senderId = sanitize(req.body.senderId);
        const text = sanitize(req.body.text);

        // Rate limiting check using Redis

        // Create and save new message
        const newMessage = new messageModel({
            chatId,
            senderId,
            text
        });

        const savedMessage = await newMessage.save();

        // Update the last message in the chat
        await chatModel.findByIdAndUpdate(chatId, {
            lastMessage: savedMessage._id,
            lastMessageTimestamp: savedMessage.createdAt
        });

        res.status(201).json(savedMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get messages for a specific chat
const getMessage = async (req, res) => {
    try {
        const chatId = sanitize(req.params.chatId);

        const messages = await messageModel.find({ chatId })
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get latest messages for all user chats (using aggregation pipeline)
const getLatestMessages = async (req, res) => {
    try {
        const userId = sanitize(req.params.userId);

        // Find all chats the user is a member of
        const userChats = await chatModel.find({
            members: { $in: [userId] }
        });

        const chatIds = userChats.map(chat => chat._id);

        // Aggregation pipeline to get latest message for each chat
        const latestMessages = await messageModel.aggregate([
            // Match messages from user's chats
            { $match: { chatId: { $in: chatIds } } },

            // Group by chatId and get the latest message
            { $sort: { createdAt: -1 } },
            { $group: {
                    _id: "$chatId",
                    messageId: { $first: "$_id" },
                    senderId: { $first: "$senderId" },
                    text: { $first: "$text" },
                    createdAt: { $first: "$createdAt" }
                }},

            // Lookup chat details
            { $lookup: {
                    from: "chats",
                    localField: "_id",
                    foreignField: "_id",
                    as: "chatInfo"
                }},
            { $unwind: "$chatInfo" },

            // Sort by latest message
            { $sort: { createdAt: -1 } },

            // Project final format
            { $project: {
                    _id: 0,
                    chatId: "$_id",
                    messageId: 1,
                    senderId: 1,
                    text: 1,
                    createdAt: 1,
                    members: "$chatInfo.members",
                    groupName: "$chatInfo.groupName",
                    isGroup: "$chatInfo.isGroup"
                }}
        ]);

        res.status(200).json(latestMessages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete a message
const deleteMessage = async (req, res) => {
    try {
        const messageId = sanitize(req.params.messageId);
        const userId = sanitize(req.body.userId); // For authorization

        const message = await messageModel.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Check if user is the sender of the message
        if (message.senderId.toString() !== userId) {
            return res.status(403).json({ message: "Not authorized to delete this message" });
        }

        await messageModel.findByIdAndDelete(messageId);

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



module.exports = {
    createMessage,
    getMessage,
    getLatestMessages,
    deleteMessage,
};