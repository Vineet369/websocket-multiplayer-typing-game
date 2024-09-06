const http = require("http");
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const app = express();

// app.use(express.static(__dirname + '/public'));
// app.get('/', (req, res) => { res.sendFile(__dirname + "/index.html") })
// app.listen(9091, () => console.log("Listening on http port 9091"))

dotenv.config({
    path: './.env'
})

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
const PORT = process.env.PORT || 3000

const websocketServer = require("websocket").server
const httpServer = http.createServer();
httpServer.listen(PORT,'0.0.0.0', () => console.log("listening on 9090"))

//hashmap
const clients = {};
const games = {};
let admin = null;
// let playerName = null;
const wsServer = new websocketServer({
    "httpServer": httpServer,
})

const quoteUrl = 'https://dummyjson.com/quotes/random';
let quote;



function randomQuotes() {
    return fetch(quoteUrl)
        .then(res => res.json())
        .then(data => data.quote)

}

wsServer.on("request", request => {
    const connection = request.accept(null, request.origin)
    connection.on("open", () => console.log("Opened!"))
    connection.on("close", () => console.log("Closed!"))
    connection.on("message", (message) => {
        const result = JSON.parse(message.utf8Data);
        
        if (result.method === "create") {
            async function generateQuote() {
                quote = await randomQuotes()
                const clientId = result.clientId;
                admin = clientId;
                const adminName = result.adminName;
                // console.log(clientId,adminName)
                const gameId = guid();
                games[`${gameId}`] = {
                    "id": gameId,
                    "displayText": quote,
                    "clients": [
                        {
                            "clientId": clientId,
                            "playerName": adminName,
                            "color": "#E59462",
                            "progress": 0,
                            "score": 0
                        }
                    ],
                    "entry": true
                };
                // console.log()
                const payload = {
                    "method": "join",
                    "game": games[gameId],
                    "admin": true,
                    "quote": quote

                };
                // console.log(JSON.stringify(games) + "pay");

                const con = clients[clientId].connection;
                con.send(JSON.stringify(payload));
            }
            generateQuote()
        }

        if (result.method === "join") {

            const clientId = result.clientId;
            const gameId = result.gameId;
            const playerName = result.playerName
            const game = games[gameId];
            if (game.entry) {
                const color = { "0": "#552619", "1": "#c83f5f", "2": "#144058", "3": "#B6E696", "4": "#355952" }[game.clients.length]
                // console.log(game.clients.length + "game clients")

                game.clients.push({
                    "clientId": clientId,
                    "playerName": playerName,
                    "color": color,
                    "progress": 0,
                    "score": 0

                })


                game.clients.forEach(c => {
                    const payload = {
                        "method": "join",
                        "game": game,
                        "admin": (c.clientId === admin) ? true : false,
                        "quote": quote
                    }
                    clients[c.clientId].connection.send(JSON.stringify(payload))
                })
            }
            else {
                const payload = {
                    "method": "invalid entry",
                    "game": game,

                }
                // console.log("server sent invalid entry")
                clients[clientId].connection.send(JSON.stringify(payload))
            }
        }

        if (result.method === "start") {
            const clientId = result.clientId
            const gameId = result.gameId
            const game = games[gameId]
            if (clientId === admin) {
                game.entry = false

                game.clients.forEach(c => {
                    const payload = {
                        "method": "start",
                        "game": game,
                        // "quote": quote
                    }
                    clients[c.clientId].connection.send(JSON.stringify(payload))
                })


            }
        }

        if (result.method === "progress") {
            // console.log("progress recieved" + result.progress)
            const clientId = result.clientId
            const gameId = result.gameId
            const game = games[gameId]
            const progress = result.progress

            game.clients.forEach(c => {
                if (c.clientId === clientId) {
                    c.progress = progress

                }

            })
            const payload = {
                "method": "progress",
                "game": game
            }
            game.clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(payload))

            })

        }

        if (result.method === "progress completed") {
            const clientId = result.clientId
            const gameId = result.gameId
            const game = games[gameId]
            const accuracy = result.accuracy
            const duration = result.duration
            // console.log("completed" + duration)
            const w1 = 0.5
            const w2 = 0.5
            const score = (w1 * accuracy) + (w2 * (1 / duration) * 1000)
            // console.log(accuracy,duration)
            game.clients.forEach(c => {
                if (c.clientId === clientId) {
                    c.score = score
                    // console.log("score server" + c.score)
                }
            })

            const payload = {
                "method": "result",
                "game": game
            }

            game.clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(payload))
            })
            // console.log("result sent" + game.clients + payload + )

        }


    });


    const clientId = guid();
    clients[clientId] = {
        "connection": connection
    }

    const payload = {
        "method": "connect",
        "clientId": clientId
    }

    connection.send(JSON.stringify(payload))
})


function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring()
}

const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4()).substring()