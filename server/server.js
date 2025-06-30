const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'https://chessgame-85747.vercel.app', // exact frontend origin
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});


const PORT = process.env.PORT || 3000;

const games = new Map(); // gameCode => [socket1, socket2]

app.use(cors());
app.get('/', (req, res) => {
    res.send('Chess backend is running.');
});

const DISCONNECT_TIMEOUT_MS = 15000; // 15 seconds grace period
const disconnectTimers = new Map();  // socket.id => timeoutId

io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('join-game', ({ code }) => {
        if (!code) return;
        console.log(`♟️ Player ${socket.id} joined game: ${code}`);

        if (!games.has(code)) games.set(code, []);

        const players = games.get(code);

        if (players.length >= 2) {
            socket.emit('error', 'Game full');
            return;
        }

        players.push(socket);
        socket.join(code);
        socket.gameCode = code;

        if (players.length === 2) {
            players.forEach(s => s.emit('start-game'));
        }

        // Cancel pending disconnect timeout if reconnecting
        if (disconnectTimers.has(socket.id)) {
            clearTimeout(disconnectTimers.get(socket.id));
            disconnectTimers.delete(socket.id);
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

        // Wait before declaring game over
        const timeoutId = setTimeout(() => {
            if (code && games.has(code)) {
                const players = games.get(code).filter(s => s.id !== socket.id);
                games.set(code, players);

                if (players.length > 0) {
                    players.forEach(s => s.emit('game-over-disconnect'));
                } else {
                    games.delete(code);
                }
            }

            disconnectTimers.delete(socket.id);
        }, DISCONNECT_TIMEOUT_MS);

        disconnectTimers.set(socket.id, timeoutId);
    });
});
