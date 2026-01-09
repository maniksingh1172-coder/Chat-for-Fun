import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // Increased to 10MB to handle high-quality images
});

app.use(express.static('public'));

let strangerQueue = [];

io.on('connection', (socket) => {
    // Stranger Logic
    socket.on('find-stranger', (profile) => {
        socket.profile = profile;
        strangerQueue = strangerQueue.filter(s => s.id !== socket.id);
        if (strangerQueue.length > 0) {
            let partner = strangerQueue.pop();
            let room = `stranger_${socket.id}_${partner.id}`;
            socket.join(room); partner.join(room);
            socket.room = room; partner.room = room;
            io.to(room).emit('user-connected', { partner: socket.profile }); 
            io.to(room).emit('user-connected', { partner: partner.profile });
        } else { strangerQueue.push(socket); }
    });

    // Multi-User Private Room Logic
    socket.on('join-room', ({ roomID, profile }) => {
        socket.profile = profile;
        socket.room = roomID;
        socket.join(roomID);
        io.to(roomID).emit('user-connected', { partner: profile });
    });

    // Unified Message & Media Relay
    socket.on('chat-msg', (data) => {
        if (socket.room) socket.to(socket.room).emit('chat-msg', data);
    });

    socket.on('media-msg', (data) => {
        if (socket.room) {
            // Sends the image to everyone else in the room
            socket.to(socket.room).emit('media-msg', { sender: socket.profile.name, ...data }); 
        }
    });

    socket.on('leave-chat', () => {
        if (socket.room) {
            socket.to(socket.room).emit('user-left', socket.profile?.name);
            socket.leave(socket.room);
            socket.room = null;
        }
    });

    socket.on('disconnect', () => {
        strangerQueue = strangerQueue.filter(s => s.id !== socket.id);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Premium Image-Ready Server on ${PORT}`));
