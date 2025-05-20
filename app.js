const express = require('express');
const app = express();
require('dotenv').config();
const http = require('http'); // Import the HTTP module
const { Server } = require('socket.io'); // Import Socket.IO
const cors = require('cors');
const mongoose = require('mongoose');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: 'https://chat-app-client-rouge.vercel.app', // Remove the trailing slash
    credentials: true
}));

// MongoDB Connection
let URI = "mongodb+srv://<username>:<password>@cluster0.g7zuc4b.mongodb.net/chat?retryWrites=true&w=majority"
const local = 'mongodb://localhost:27017/auth'
let Option = { user: 'sifat355y', pass: 'gKowylzIvl736M3I', autoIndex: true, useNewUrlParser: true, useUnifiedTopology: true }
mongoose.connect(local)
    .then(() => {
        console.log('Connection Success');
    })
    .catch((error) => {
        console.error('Connection Error:', error);
    });

// Routes
const router = require('./src/routers/api');
app.use("/api/v1", router);

// Undefined Route Handler
app.use("*", (req, res) => {
    res.status(404).json({ status: "fail", data: "Not Found" });
});

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
const io = new Server(server, {
    cors: {
        origin: 'https://chat-app-client-rouge.vercel.app/', // Remove the trailing slash
        methods: ["GET", "POST"],
    }
});

// Socket.IO Logic
let onlineUsers = [];

io.on('connection', (socket) => {
    console.log('Connected to server...', socket.id);

    // Add new user to the online users list
    socket.on('addNewUser', (userId) => {
        if (!onlineUsers.some(user => user.userId === userId)) {
            onlineUsers.push({
                userId,
                socketId: socket.id
            });
        }
        io.emit('getOnlineUsers', onlineUsers); // Emit the updated list to all clients
    });

    // Handle sending messages
    socket.on("sendMessage", (message) => {
        const user = onlineUsers.find(user => user.userId === message.recipientId);
        if (user) {
            io.to(user.socketId).emit('getMessage', message); // Send message to the recipient
            io.to(user.socketId).emit('getNotification', {
                senderId: message.senderId,
                isRead: false,
                date: new Date()
            });
        }
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
        onlineUsers = onlineUsers.filter(user => user.socketId !== socket.id);
        io.emit('getOnlineUsers', onlineUsers); // Emit the updated list to all clients
    });
});

// Export the server (optional, if needed elsewhere)
module.exports = server;