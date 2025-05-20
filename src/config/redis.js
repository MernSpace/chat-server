const {createClient} = require('redis');
require('dotenv').config();

// Configure Redis client
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        // Reconnection strategy
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create Redis client
const redisClient = createClient(redisConfig);

// Handle Redis errors
redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
});

// Log when connected
redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

// Subscribe to presence updates (for websocket server to use)
const subscriberClient = redisClient.duplicate();

subscriberClient.subscribe('presence:update', (err) => {
    if (err) {
        console.error('Failed to subscribe to presence channel:', err);
    } else {
        console.log('Subscribed to presence:update channel');
    }
});

// On message handler (to be used with WebSocket server)
subscriberClient.on('message', (channel, message) => {
    // This will be used by WebSocket server to broadcast updates
    console.log(`Received ${message} from ${channel}`);
    // WebSocket broadcast logic would go here in the actual WebSocket server
});

// Helper function to get all online users
const getOnlineUsers = async () => {
    const keys = await redisClient.keys('presence:*');
    const users = [];

    for (const key of keys) {
        if (key !== 'presence:update') {
            const userId = key.split(':')[1];
            users.push(userId);
        }
    }

    return users;
};

// Helper for publishing typing status
const publishTypingStatus = async (chatId, userId, isTyping) => {
    return redisClient.publish(`chat:${chatId}:typing`, JSON.stringify({
        userId,
        isTyping,
        timestamp: Date.now()
    }));
};

// Subscribe to typing status for a specific chat
const subscribeToTypingStatus = async (chatId, callback) => {
    const subscriber = redisClient.duplicate();
    await subscriber.subscribe(`chat:${chatId}:typing`);

    subscriber.on('message', (channel, message) => {
        callback(JSON.parse(message));
    });

    return subscriber;
};

// Rate limiting implementation
const checkRateLimit = async (key, limit, window) => {
    const count = await redisClient.incr(key);

    if (count === 1) {
        await redisClient.expire(key, window);
    }

    return count <= limit;
};

module.exports = {
    client: redisClient,
    subscriber: subscriberClient,
    getOnlineUsers,
    publishTypingStatus,
    subscribeToTypingStatus,
    checkRateLimit,
    // Export Redis client methods directly for convenience
    get: async (key) => redisClient.get(key),
    set: async (key, value) => redisClient.set(key, value),
    setex: async (key, seconds, value) => redisClient.setex(key, seconds, value),
    del: async (key) => redisClient.del(key),
    incr: async (key) => redisClient.incr(key),
    expire: async (key, seconds) => redisClient.expire(key, seconds),
    ttl: async (key) => redisClient.ttl(key),
    publish: async (channel, message) => redisClient.publish(channel, message),
    pipeline: () => redisClient.pipeline(),
    keys: async (pattern) => redisClient.keys(pattern)
};