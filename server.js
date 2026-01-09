
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static('public')); // Critical for serving index.html

let queue = [];

io.on('connection', (socket) => {
    socket.on('join-queue', (profile) => {
        socket.profile = profile;
        if (queue.length > 0) {
            let partner = queue.pop();
            let room = `room_${socket.id}_${partner.id}`;
            socket.join(room);
            partner.join(room);
            socket.room = room;
            partner.room = room;

            io.to(socket.id).emit('match-found', partner.profile);
            io.to(partner.id).emit('match-found', socket.profile);
            // Inside io.on('connection', (socket) => { ... })

// Relay Typing Status
socket.on('typing', (isTyping) => {
    if (socket.room) {
        socket.to(socket.room).emit('typing', isTyping);
    }
});

// Relay Multimedia Data (Images or Voice)
socket.on('media-msg', (data) => {
    if (socket.room) {
        socket.to(socket.room).emit('media-msg', data);
    }
});
        } else {
            queue.push(socket);
        }
    });

    socket.on('chat-msg', (msg) => {
        if (socket.room) {
            socket.to(socket.room).emit('chat-msg', msg);
        }
    });

    socket.on('disconnect', () => {
        queue = queue.filter(s => s.id !== socket.id);
    });
});

const PORT = process.env.PORT || 3000; // Required for Render deployment
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));

