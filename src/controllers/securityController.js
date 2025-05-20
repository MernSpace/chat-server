const redis = require('../config/redis');
const rateLimit = require('express-rate-limit');
const sanitize = require('mongo-sanitize');
const xss = require('xss');
const helmet = require('helmet');
const cors = require('cors');

// Configure and export security middleware
const configSecurity = (app) => {
    // Set up helmet for secure headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust as needed
                connectSrc: ["'self'", 'wss://*'],        // Allow WebSocket connections
                imgSrc: ["'self'", 'data:'],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'"],
            },
        },
        xssFilter: true,
        noSniff: true,
        referrerPolicy: { policy: 'same-origin' }
    }));

    // Set up CORS
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
        maxAge: 86400 // 24 hours
    }));

    // Global rate limiter
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests from this IP, please try again later'
    });

    app.use(globalLimiter);

    console.log('Security middleware configured');
};

// Specific rate limiter for message sending (10 msgs / 10 sec)
const messageRateLimiter = async (req, res, next) => {
    try {
        const userId = sanitize(req.body.senderId || req.body.userId);

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Use Redis for distributed rate limiting
        const key = `rate_limit:message:${userId}`;
        const count = await redis.incr(key);

        // Set expiry on first request
        if (count === 1) {
            await redis.expire(key, 10); // 10 seconds window
        }

        // Check limit (10 messages per 10 seconds)
        if (count > 10) {
            return res.status(429).json({
                message: "Rate limit exceeded. Please wait before sending more messages.",
                retryAfter: await redis.ttl(key)
            });
        }

        next();
    } catch (error) {
        console.error('Rate limiting error:', error);
        // Continue on error to prevent blocking legitimate requests
        next();
    }
};

// Middleware to sanitize request data
const sanitizeData = (req, res, next) => {
    try {
        // Sanitize body (protection against NoSQL injection)
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                if (typeof req.body[key] === 'string') {
                    // Sanitize against MongoDB operators
                    req.body[key] = sanitize(req.body[key]);
                    // Sanitize against XSS
                    req.body[key] = xss(req.body[key]);
                }
            });
        }

        // Sanitize params
        if (req.params) {
            Object.keys(req.params).forEach(key => {
                if (typeof req.params[key] === 'string') {
                    req.params[key] = sanitize(req.params[key]);
                    req.params[key] = xss(req.params[key]);
                }
            });
        }

        // Sanitize query
        if (req.query) {
            Object.keys(req.query).forEach(key => {
                if (typeof req.query[key] === 'string') {
                    req.query[key] = sanitize(req.query[key]);
                    req.query[key] = xss(req.query[key]);
                }
            });
        }

        next();
    } catch (error) {
        console.error('Sanitization error:', error);
        next();
    }
};

// Specific rate limiter for login attempts
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 failed attempts per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Skip if request resulted in a successful authentication
    message: 'Too many login attempts, please try again later'
});

// Middleware to check for active sessions
const checkActiveSession = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.body.userId;

        if (!userId) {
            return next();
        }

        // Check if user has active session
        const sessionKey = `session:${userId}`;
        const currentToken = req.headers.authorization?.split(' ')[1];
        const storedToken = await redis.get(sessionKey);

        if (storedToken && storedToken !== currentToken) {
            return res.status(401).json({
                message: "Another session is active. Please log in again."
            });
        }

        next();
    } catch (error) {
        console.error('Session check error:', error);
        next();
    }
};

module.exports = {
    configSecurity,
    messageRateLimiter,
    sanitizeData,
    loginRateLimiter,
    checkActiveSession
};