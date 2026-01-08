import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, { 
    maxHttpBufferSize: 1e8 // Support for audio and image relaying
}); 

app.use(express.static('public'));

let waitingUser = null;
const bannedIPs = new Set();
const reportCounts = new Map();

io.on('connection', (socket) => {
    const userIP = socket.handshake.address;
    if (bannedIPs.has(userIP)) return socket.disconnect();

    socket.on('join-queue', (profile) => {
        socket.profile = profile; 
        if (waitingUser && waitingUser.id !== socket.id) {
            const partner = waitingUser;
            const room = `room_${socket.id}_${partner.id}`;
            socket.join(room); partner.join(room);
            socket.room = room; partner.room = room;
            
            socket.emit('match-found', partner.profile);
            partner.emit('match-found', socket.profile);
            waitingUser = null;
        } else {
            waitingUser = socket;
        }
    });

    socket.on('chat-msg', (data) => {
        if (socket.room) socket.to(socket.room).emit('chat-msg', data);
    });

    socket.on('leave-room', () => {
        if (socket.room) {
            socket.to(socket.room).emit('system-msg', `${socket.profile?.name || 'Partner'} has left.`);
            socket.leave(socket.room);
            socket.room = null;
        }
    });

    socket.on('report-partner', () => {
        if (socket.room) {
            const pId = socket.room.split('_').find(id => id !== socket.id && id !== 'room');
            let count = (reportCounts.get(pId) || 0) + 1;
            reportCounts.set(pId, count);
            if (count >= 3) bannedIPs.add(userIP); 
            io.to(socket.room).emit('system-msg', '⚠️ Connection closed due to report.');
            io.in(socket.room).socketsLeave(socket.room);
        }
    });

    socket.on('disconnect', () => {
        if (waitingUser?.id === socket.id) waitingUser = null;
        if (socket.room) socket.to(socket.room).emit('system-msg', `${socket.profile?.name || 'Partner'} has left.`);
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

