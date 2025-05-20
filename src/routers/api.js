const express = require('express');
const router = express.Router();

// Import controllers
const {
    createChat,
    createGroupChat,
    findUserChat,
    findChat,
    getChatById,
    addMemberToGroup,
    removeMemberFromGroup
} = require('../controllers/chatController');

const {
    createMessage,
    getMessage,
    getLatestMessages,
    deleteMessage,
} = require('../controllers/messageController');

const {
    updatePresence,
    getUserPresence,
    getBulkPresence,
    heartbeat
} = require('../controllers/presenceController');

// We need to create userController methods as shown in your example
const {
    registerUser,
    loginUser,
    findUser,
    allUsers
} = require('../controllers/userController');

// Import security middleware
const { sanitizeData, messageRateLimiter, loginRateLimiter } = require('../controllers/securityController');



const auth = require('../middleware/auth')



// Apply sanitization middleware to all routes
router.use(sanitizeData);

// User routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/find-user/:id', auth, findUser);
router.get('/all-users', auth, allUsers);

// Chat routes
router.post('/chat', auth, createChat);
router.post('/group-chat', auth, createGroupChat);
router.get('/chat/:userId', auth, findUserChat);
router.get('/find/:firstId/:secondId', auth, findChat);
router.get('/chat/single/:chatId', auth, getChatById);
router.post('/chat/group/add', auth, addMemberToGroup);
router.post('/chat/group/remove', auth, removeMemberFromGroup);

// Message routes
router.post('/message', auth, messageRateLimiter, createMessage);
router.get('/message/:chatId', auth, getMessage);
router.get('/latest-messages/:userId', auth, getLatestMessages);
router.delete('/message/:messageId', auth, deleteMessage);

// Presence routes
router.post('/presence', auth, updatePresence);
router.get('/presence/:userId', auth, getUserPresence);
router.post('/presence/bulk', auth, getBulkPresence);
router.post('/heartbeat', auth, heartbeat);

module.exports = router;