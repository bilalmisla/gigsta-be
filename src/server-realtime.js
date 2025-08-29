const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let ioInstance = null;

function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:5173', 'https://gigsta.ai', 'https://gigstafrontend.netlify.app', 'https://staging.gigsta.ai'],
            credentials: true
        }
    });

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) return next(new Error('Auth token required'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = { id: decoded._id };
            return next();
        } catch (e) {
            return next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userRoom = `user:${socket.user.id}`;
        socket.join(userRoom);
        socket.on('disconnect', () => {});
    });

    ioInstance = io;
    return io;
}

function emitToUser(userId, event, payload) {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initSocket, emitToUser };


