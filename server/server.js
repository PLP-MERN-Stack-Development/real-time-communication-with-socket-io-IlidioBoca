// server.js - Socket.io Chat Server Finalizado

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar app Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(helmet()); // segurança básica
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Persistência de mensagens ---
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Carregar mensagens existentes do arquivo, se houver
let messages = [];
if (fs.existsSync(MESSAGES_FILE)) {
  try {
    messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
  } catch (err) {
    console.error('Erro ao carregar mensagens:', err);
    messages = [];
  }
}

// Função para salvar mensagens no arquivo
const saveMessages = () => {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
};

// --- Armazenamento de usuários e indicadores ---
const users = {};       // { socket.id: { username, id } }
const typingUsers = {}; // { socket.id: username }

// --- Socket.io events ---
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Usuário entra no chat
  socket.on('user_join', (username) => {
    users[socket.id] = { username, id: socket.id };
    io.emit('user_list', Object.values(users));
    io.emit('user_joined', { username, id: socket.id });
    console.log(`${username} joined. Total users: ${Object.keys(users).length}`);
  });

  // Mensagens públicas
  socket.on('send_message', (messageData) => {
    const message = {
      ...messageData,
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
    };

    messages.push(message);

    // Limitar mensagens para não ocupar muita memória
    if (messages.length > 100) messages.shift();

    saveMessages(); // Persistência

    io.emit('receive_message', message);
    console.log(`Message from ${message.sender}: ${message.message}`);
  });

  // Indicador de digitação
  socket.on('typing', (isTyping) => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      if (isTyping) typingUsers[socket.id] = username;
      else delete typingUsers[socket.id];

      io.emit('typing_users', Object.values(typingUsers));
    }
  });

  // Mensagens privadas
  socket.on('private_message', ({ to, message }) => {
    const messageData = {
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
    };

    socket.to(to).emit('private_message', messageData); // enviar para destinatário
    socket.emit('private_message', messageData);       // enviar para quem enviou
    console.log(`Private message from ${messageData.sender} to ${to}: ${message}`);
  });

  // Desconexão
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const { username } = users[socket.id];
      io.emit('user_left', { username, id: socket.id });
      console.log(`${username} left the chat`);
    }

    delete users[socket.id];
    delete typingUsers[socket.id];

    io.emit('user_list', Object.values(users));
    io.emit('typing_users', Object.values(typingUsers));
  });
});

// --- Rotas REST API ---
app.get('/api/messages', (req, res) => res.json(messages));
app.get('/api/users', (req, res) => res.json(Object.values(users)));

// Rota raiz
app.get('/', (req, res) => res.send('Socket.io Chat Server is running'));

// --- Iniciar servidor ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Exportações para testes ou integração
module.exports = { app, server, io };
 
