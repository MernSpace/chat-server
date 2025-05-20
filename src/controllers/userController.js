const userModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sanitize = require('mongo-sanitize');
const redis = require('../config/redis');

// Register new user
const registerUser = async (req, res) => {
    try {
        const {  userName, email,phone, password } = req.body;

        // Sanitize inputs

        // Check if user already exists
        const existingUserByEmail = await userModel.findOne({ email: email });
        if (existingUserByEmail) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // Encrypt password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = new userModel({
            username: userName,
            email: email,
            phone: phone,
            password : hashedPassword // Will be hashed by the pre-save hook in the model
        });

        const savedUser = await userModel.create(newUser);

        // Generate JWT token
        const token = jwt.sign(
            { userId: savedUser._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Return user without password
        res.status(201).json({
            user: savedUser.toJSON(),
            token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Login user
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Sanitize input
        const sanitizedEmail = sanitize(email);

        // Find user
        const user = await userModel.findOne({ email: sanitizedEmail });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password,user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Return user without password
        res.status(200).json({
            user: user.toJSON(),
            token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Find user by ID
const findUser = async (req, res) => {
    try {
        const userId = sanitize(req.params.id);

        const user = await userModel.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            ...user.toObject(),

        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all users (with pagination)
const allUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        const skip = (page - 1) * limit;

        // Create search query
        const searchQuery = search ? {
            $or: [
                { username: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        } : {};

        // Get users with pagination
        const users = await userModel
            .find(searchQuery)
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Get total count for pagination
        const total = await userModel.countDocuments(searchQuery);

        res.status(200).json({
            users: total,
            pagination: {
                total,
                users,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Logout user
const logoutUser = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Remove session from Redis
        await redis.del(`session:${userId}`);

        // Set user as offline
        await redis.del(`presence:${userId}`);

        // Update user's online status in database
        await userModel.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: new Date()
        });

        // Publish presence update
        await redis.publish('presence:update', JSON.stringify({
            userId,
            isOnline: false,
            timestamp: Date.now()
        }));

        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update user profile
const updateUser = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { name, status, profilePicture } = req.body;

        // Fields to update
        const updateFields = {};

        if (name) updateFields.name = sanitize(name);
        if (status) updateFields.status = sanitize(status);
        if (profilePicture) updateFields.profilePicture = sanitize(profilePicture);

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true }
        ).select('-password');

        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    findUser,
    allUsers,
    logoutUser,
    updateUser
};