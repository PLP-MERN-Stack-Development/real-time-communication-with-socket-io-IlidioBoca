// socket.js - Socket.io client fully integrated
import { io } from 'socket.io-client';
import { useEffect, useState, useRef } from 'react';

// --- Configuração do servidor Socket.io ---
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Cria instância do socket
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// --- Hook React para consumir o socket ---
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const messagesEndRef = useRef(null);

  // --- Conectar usuário ---
  const connect = (name) => {
    if (!name) return;
    setUsername(name);
    socket.connect();
    socket.emit('user_join', name);
  };

  // --- Desconectar usuário ---
  const disconnect = () => {
    socket.disconnect();
    setUsername('');
    setUsers([]);
    setMessages([]);
    setTypingUsers([]);
    setSelectedUser(null);
  };

  // --- Enviar mensagem pública ---
  const sendMessage = (msg) => {
    if (!msg) return;
    socket.emit('send_message', { message: msg });
    setMessage('');
    setTyping(false);
  };

  // --- Enviar mensagem privada ---
  const sendPrivateMessage = (toId, msg) => {
    if (!toId || !msg) return;
    socket.emit('private_message', { to: toId, message: msg });
    setMessage('');
    setTyping(false);
  };

  // --- Digitação ---
  const setTyping = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  // --- Scroll automático ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Eventos do socket ---
  useEffect(() => {
    // Conexão
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Mensagens públicas e privadas
    socket.on('receive_message', (msg) => setMessages((prev) => [...prev, msg]));
    socket.on('private_message', (msg) => setMessages((prev) => [...prev, msg]));

    // Usuários
    socket.on('user_list', (list) => setUsers(list));
    socket.on('user_joined', (user) => {
      setUsers((prev) => [...prev, user]);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    });
    socket.on('user_left', (user) => {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    // Digitação
    socket.on('typing_users', (list) => setTypingUsers(list));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receive_message');
      socket.off('private_message');
      socket.off('user_list');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('typing_users');
    };
  }, []);

  // Atualiza scroll ao receber novas mensagens
  useEffect(scrollToBottom, [messages]);

  // --- Componente de UI pronto para uso ---
  const ChatUI = () => (
    <div className="flex h-screen bg-gray-100">
      {/* Lista de usuários */}
      <div className="w-64 bg-white border-r border-gray-300 p-4">
        <h2 className="text-xl font-bold mb-4">Users</h2>
        {users.map((user) => (
          <div
            key={user.id}
            className={`p-2 mb-2 rounded cursor-pointer ${
              selectedUser?.id === user.id ? 'bg-blue-200' : 'hover:bg-gray-200'
            }`}
            onClick={() => setSelectedUser(user)}
          >
            {user.username}
          </div>
        ))}
      </div>

      {/* Chat principal */}
      <div className="flex-1 flex flex-col">
        {!isConnected && (
          <div className="p-4">
            <input
              className="border p-2 rounded mr-2 w-64"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => connect(username)}
            >
              Join
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 rounded ${
                msg.system ? 'text-gray-500 italic' : msg.isPrivate ? 'bg-purple-100' : 'bg-white'
              }`}
            >
              {msg.system ? msg.message : `${msg.sender}: ${msg.message}`}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Indicador de digitação */}
        <div className="p-2 h-8 text-gray-600">
          {typingUsers.length > 0 && (
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          )}
        </div>

        {/* Input de envio */}
        {isConnected && (
          <div className="flex p-4 border-t border-gray-300">
            <input
              type="text"
              className="flex-1 border p-2 rounded mr-2"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setTyping(e.target.value.length > 0);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (selectedUser ? sendPrivateMessage(selectedUser.id, message) : sendMessage(message))}
            />
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => (selectedUser ? sendPrivateMessage(selectedUser.id, message) : sendMessage(message))}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return {
    socket,
    isConnected,
    messages,
    users,
    typingUsers,
    username,
    message,
    selectedUser,
    setUsername,
    setMessage,
    setSelectedUser,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    ChatUI,
  };
};

export default socket;
