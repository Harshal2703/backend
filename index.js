const express = require('express')
const http = require('http')
const app = express()
const server = http.createServer(app)
const { Server } = require('socket.io')
require('dotenv').config();
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.DB_URI);
const db = client.db('ChessMateMain');
let collection = db.collection('Games');
const io = new Server(server, {
    cors: {
        origin: '*',
    },
})



io.on('connection', (socket) => {
    console.log("connected : ", socket.id)
    socket.on('joinRoom', async (roomId) => {
        await client.connect()
        socket.join(roomId);
        const gameObj = await collection.findOne({ 'gameId': roomId })
        io.sockets.in(roomId).emit('newUser', socket.id);
        io.sockets.in(roomId).emit('gameObj', gameObj);
        await client.close()
    })


    socket.on('chat', async (data) => {
        console.log(data)
        await client.connect()
        let filter = { gameId: data.roomId }
        let updateDoc = { $push: { "textChats": { 'username': data.username, 'email': data.email, "message": data.message, "mId": data.mId } } }
        await collection.updateOne(filter, updateDoc)
        const gameObj = await collection.findOne({ "gameId": data.roomId })
        console.log(gameObj)
        client.close()
        io.sockets.in(data.roomId).emit('gameObj', gameObj);
    })
    socket.on('abort', async ({ gameId, email }) => {
        try {

            await client.connect()
            let gameObj = await collection.findOne({ "gameId": gameId })
            if (gameObj && !gameObj.gameOn) {
                const challenger = gameObj.challenger
                const acceptor = gameObj.acceptor
                let filter = { "gameId": gameId }
                let updateDoc = {
                    $set: {
                        "aborted": true
                    }
                }
                await collection.updateOne(filter, updateDoc)
                collection = db.collection('Users')
                updateDoc = {
                    $set: {
                        "active-game": null
                    }
                }
                filter = { "email": challenger }
                await collection.updateOne(filter, updateDoc)
                filter = { "email": acceptor }
                await collection.updateOne(filter, updateDoc)
                collection = db.collection('Games')
                gameObj = await collection.findOne({ "gameId": gameId })
                await client.close()
                console.log(gameObj, "hete", gameId)
                io.sockets.in(gameId).emit('gameObj', { gameObj, "abortSignal": 200, "message": "aborted successfully" });
            }
        } catch (error) {
            client.close()
        }
    })
})

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log('✔️ Server listening on port 3001')
})



// const db = mongoClient.db('ChessMateMain');
// let collection = db.collection('Users');
// const serverInfoOfUser = (await collection.find({ 'email': payload.email }).toArray())[0]