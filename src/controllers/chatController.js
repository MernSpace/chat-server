const chatModel = require('../models/chatModel');
const userModel = require('../models/userModel');
const sanitize = require('mongo-sanitize');

// Create a new chat (1-to-1)
const createChat = async (req, res) => {
    const { sender_id, receiver_id } = req.body;

    // Sanitize inputs
    const sanitizedSenderId = sanitize(sender_id);
    const sanitizedReceiverId = sanitize(receiver_id);

    try {
        // Check if chat already exists
        const chat = await chatModel.findOne({
            members: { $all: [sanitizedSenderId, sanitizedReceiverId] },
            isGroup: false
        });

        if (chat) return res.status(200).json(chat);

        // Create new chat
        const newChat = new chatModel({
            members: [sanitizedSenderId, sanitizedReceiverId],
            isGroup: false
        });

        const response = await newChat.save();
        return res.status(201).json(response);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Find all chats for a user
const findUserChat = async (req, res) => {
    const userId = sanitize(req.params.userId);

    try {
        const chats = await chatModel.find({
            members: { $in: [userId] }
        });

        res.status(200).json(chats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Find a specific chat between two users
const findChat = async (req, res) => {
    const { senderID, receiverID } = req.params;

    // Sanitize inputs
    const sanitizedSenderId = sanitize(senderID);
    const sanitizedReceiverId = sanitize(receiverID);

    try {
        const chat = await chatModel.findOne({
            members: { $all: [sanitizedSenderId, sanitizedReceiverId] },
            isGroup: false
        });

        res.status(200).json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a group chat
const createGroupChat = async (req, res) => {
    const { name, members, creator_id } = req.body;

    // Sanitize inputs
    const sanitizedName = sanitize(name);
    const sanitizedMembers = members.map(member => sanitize(member));
    const sanitizedCreatorId = sanitize(creator_id);

    try {
        // Ensure creator is included in members
        if (!sanitizedMembers.includes(sanitizedCreatorId)) {
            sanitizedMembers.push(sanitizedCreatorId);
        }

        // Validate minimum group size
        if (sanitizedMembers.length < 2) {
            return res.status(400).json({ message: "Group chat requires at least 2 members" });
        }

        const newGroupChat = new chatModel({
            groupName: sanitizedName,
            members: sanitizedMembers,
            admin: sanitizedCreatorId,
            isGroup: true
        });

        const savedGroupChat = await newGroupChat.save();
        return res.status(201).json(savedGroupChat);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Get a specific chat by ID
const getChatById = async (req, res) => {
    const chatId = sanitize(req.params.chatId);

    try {
        const chat = await chatModel.findById(chatId);

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        res.status(200).json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add member to group chat
const addMemberToGroup = async (req, res) => {
    const { chatId, userId, adminId } = req.body;

    // Sanitize inputs
    const sanitizedChatId = sanitize(chatId);
    const sanitizedUserId = sanitize(userId);
    const sanitizedAdminId = sanitize(adminId);

    try {
        const chat = await chatModel.findById(sanitizedChatId);

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        // Check if it's a group chat
        if (!chat.isGroup) {
            return res.status(400).json({ message: "This is not a group chat" });
        }

        // Check if requester is admin
        if (chat.admin.toString() !== sanitizedAdminId) {
            return res.status(403).json({ message: "Only admin can add members" });
        }

        // Check if user is already a member
        if (chat.members.includes(sanitizedUserId)) {
            return res.status(400).json({ message: "User is already a member of this group" });
        }

        // Add member
        chat.members.push(sanitizedUserId);
        await chat.save();

        res.status(200).json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Remove member from group chat
const removeMemberFromGroup = async (req, res) => {
    const { chatId, userId, adminId } = req.body;

    // Sanitize inputs
    const sanitizedChatId = sanitize(chatId);
    const sanitizedUserId = sanitize(userId);
    const sanitizedAdminId = sanitize(adminId);

    try {
        const chat = await chatModel.findById(sanitizedChatId);

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        // Check if it's a group chat
        if (!chat.isGroup) {
            return res.status(400).json({ message: "This is not a group chat" });
        }

        // Check if requester is admin
        if (chat.admin.toString() !== sanitizedAdminId) {
            return res.status(403).json({ message: "Only admin can remove members" });
        }

        // Check if admin is trying to remove themselves
        if (sanitizedUserId === sanitizedAdminId) {
            return res.status(400).json({ message: "Admin cannot be removed from the group" });
        }

        // Remove member
        chat.members = chat.members.filter(member => member.toString() !== sanitizedUserId);
        await chat.save();

        res.status(200).json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createChat,
    findUserChat,
    findChat,
    createGroupChat,
    getChatById,
    addMemberToGroup,
    removeMemberFromGroup
};