const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*', 
    methods: ['GET', 'POST'],
  },
})

// Estrutura para armazenar as salas
const rooms = {}

// Função para criar uma nova sala
function createRoom() {
  const roomId = uuidv4()
  rooms[roomId] = {
    host: null,
    guest: null,
    hostNumber: null,
    guestNumber: null,
    winner: null,
  }
  return roomId
}

// Função para verificar se a sala existe
function roomExists(roomId) {
  return !!rooms[roomId]
}

// Função para adicionar um jogador à sala
function joinRoom(roomId, socket) {
  if (!roomExists(roomId)) return null

  const room = rooms[roomId]
  if (!room.host) {
    room.host = socket.id
    return 'host'
  } else if (!room.guest) {
    room.guest = socket.id
    return 'guest'
  }
  return null
}

// Função para atualizar o número secreto
function setSecretNumber(roomId, role, number) {
  if (!roomExists(roomId)) return false

  const room = rooms[roomId]
  if (role === 'host') {
    room.hostNumber = number
  } else if (role === 'guest') {
    room.guestNumber = number
  }
  return true
}

// Função para processar palpites
function makeGuess(roomId, role, guess) {
  if (!roomExists(roomId)) return false

  const room = rooms[roomId]
  const opponentNumber = role === 'host' ? room.guestNumber : room.hostNumber

  if (guess === opponentNumber) {
    room.winner = role
    return { success: true, message: 'Você acertou!', winner: role }
  } else if (guess < opponentNumber) {
    return { success: false, message: 'O número do adversário é maior.' }
  } else {
    return { success: false, message: 'O número do adversário é menor.' }
  }
}

// Eventos do Socket.IO
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id)

  socket.on('createRoom', () => {
    const roomId = createRoom()
    socket.join(roomId) // Adiciona o jogador à sala
    socket.emit('roomCreated', { roomId })
  })

  socket.on('joinRoom', ({ roomId }) => {
    const role = joinRoom(roomId, socket)
    if (role) {
      socket.join(roomId) // Adiciona o jogador à sala
      socket.emit('joinedRoom', { role })
    } else {
      socket.emit('error', { message: 'Sala cheia ou não encontrada.' })
    }
  })

  socket.on('setSecretNumber', ({ roomId, role, number }) => {
    const success = setSecretNumber(roomId, role, number)
    if (success) {
      socket.emit('numberSet')
    } else {
      socket.emit('error', { message: 'Erro ao definir número.' })
    }
  })

  socket.on('makeGuess', ({ roomId, role, guess }) => {
    const result = makeGuess(roomId, role, guess)
    socket.emit('guessResult', result)

    if (result.success) {
      io.to(roomId).emit('gameOver', { winner: result.winner }) // Notifica todos na sala
    }
  })

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id)
  })
})

// Iniciar o servidor
const PORT = 3000
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})