const http = require('http');
const socket = require('socket.io');
const myIo = require('./sockets/io');

const server = http.createServer();
const io = socket(server);

global.games = {};

myIo(io);

server.listen(process.env.PORT, () => {
  console.log('Socket.IO server listening on port 3037');
});
