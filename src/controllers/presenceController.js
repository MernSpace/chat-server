const redis = require('../config/redis');
const userModel = require('../models/userModel');
const sanitize = require('mongo-sanitize');

// Update user online status
const updatePresence = async (req, res) => {
    try {
        const userId = sanitize(req.body.userId);
        const isOnline = req.body.isOnline;

        // Update user presence in Redis
        if (isOnline) {
            // Set user as online with expiry (auto-offline after inactivity)
            await redis.setex(`presence:${userId}`, 300, 'online'); // 5 minutes expiry
        } else {
            // Remove user from online users
            await redis.del(`presence:${userId}`);
        }

        // Publish presence update to Redis pub/sub
        await redis.publish('presence:update', JSON.stringify({
            userId,
            isOnline,
            timestamp: Date.now()
        }));

        // Update last active timestamp in user model
        await userModel.findByIdAndUpdate(userId, {
            lastActive: new Date(),
            isOnline
        });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get user's online status
const getUserPresence = async (req, res) => {
    try {
        const userId = sanitize(req.params.userId);

        // Check Redis for real-time presence status
        const status = await redis.get(`presence:${userId}`);

        if (status === 'online') {
            return res.status(200).json({ isOnline: true });
        }

        // If not in Redis, check database for last active time
        const user = await userModel.findById(userId, 'lastActive isOnline');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Return user online status and last active time
        res.status(200).json({
            isOnline: false,
            lastActive: user.lastActive
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get multiple users' presence status
const getBulkPresence = async (req, res) => {
    try {
        const userIds = req.body.userIds.map(id => sanitize(id));

        const presenceData = {};

        // Get online status from Redis for all users in bulk
        const pipeline = redis.pipeline();
        userIds.forEach(userId => {
            pipeline.get(`presence:${userId}`);
        });

        const results = await pipeline.exec();

        // Process Redis results
        for (let i = 0; i < userIds.length; i++) {
            const userId = userIds[i];
            const isOnline = results[i][1] === 'online';

            presenceData[userId] = {
                isOnline,
                userId
            };
        }

        // For offline users, get last active time from database
        const offlineUserIds = userIds.filter(userId => !presenceData[userId]?.isOnline);

        if (offlineUserIds.length > 0) {
            const users = await userModel.find(
                { _id: { $in: offlineUserIds } },
                'lastActive'
            );

            users.forEach(user => {
                if (presenceData[user._id]) {
                    presenceData[user._id].lastActive = user.lastActive;
                }
            });
        }

        res.status(200).json(presenceData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Heartbeat to keep user's online status active
const heartbeat = async (req, res) => {
    try {
        const userId = sanitize(req.body.userId);

        // Refresh user's online status in Redis
        await redis.setex(`presence:${userId}`, 300, 'online'); // Reset to 5 minutes

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    updatePresence,
    getUserPresence,
    getBulkPresence,
    heartbeat
};