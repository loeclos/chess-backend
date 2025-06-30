const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*', // You can restrict this in production
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

const games = new Map(); // gameCode => [socket1, socket2]

app.use(cors());
app.get('/', (req, res) => {
    res.send('Chess backend is running.');
});

io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('join-game', ({ code }) => {
        console.log(`♟️ Player ${socket.id} joined game: ${code}`);
        
        if (!games.has(code)) {
            games.set(code, []);
        }

        const players = games.get(code);

        if (players.length >= 2) {
            console.log(`❌ Game ${code} already full`);
            socket.emit('error', 'Game full');
            return;
        }

        players.push(socket);
        socket.join(code);
        socket.gameCode = code;

        if (players.length === 2) {
            console.log(`✅ Game ${code} is starting`);
            players.forEach(s => s.emit('start-game'));
        }
    });

    socket.on('move', (move) => {
        const code = socket.gameCode;
        if (!code) return;
        socket.to(code).emit('new-move', move);
    });

    socket.on('disconnect', () => {
        const code = socket.gameCode;
        console.log(`🚪 Player ${socket.id} disconnected from game ${code}`);

        if (code && games.has(code)) {
            const players = games.get(code).filter(s => s.id !== socket.id);
            games.set(code, players);

            if (players.length > 0) {
                players.forEach(s => s.emit('game-over-disconnect'));
            } else {
                games.delete(code);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
