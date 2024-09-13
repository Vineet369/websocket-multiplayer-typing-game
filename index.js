const http = require("http");
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const app = express();

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
httpServer.listen(PORT,'0.0.0.0', () => console.log("listening on 3000"))

//constants and variables------------------------------------------
const clients = {};
const games = {};
let admin = null;
let quote;

const wsServer = new websocketServer({
    "httpServer": httpServer,
})

// Display text api and fetch functionality-------------------------
const quoteUrl = 'https://dummyjson.com/quotes/random';

function randomQuotes() {
    return fetch(quoteUrl)
        .then(res => res.json())
        .then(data => data.quote)

}

//client requests and server responses using websocket--------------
wsServer.on("request", request => {
    const connection = request.accept(null, request.origin)
    connection.on("open", () => console.log("Opened!"))
    connection.on("close", () => console.log("Closed!"))
    connection.on("message", (message) => {
        const result = JSON.parse(message.utf8Data);
        
        // client create message
        if (result.method === "create") {
            async function generateQuote() {
                quote = await randomQuotes()
                const clientId = result.clientId;
                admin = clientId;
                const adminName = result.adminName;
                const gameId = guid();
                games[`${gameId}`] = {
                    "id": gameId,
                    "displayText": quote,
                    "clients": [
                        {
                            "clientId": clientId,
                            "playerName": adminName,
                            "color": "#E59462",
                            "admin": true,
                            "progress": 0,
                            "score": 0
                        }
                    ],
                    "entry": true
                };
                const payload = {
                    "method": "join",
                    "game": games[gameId],
                    "admin": true,
                    "quote": quote

                };

                //response
                const con = clients[clientId].connection;
                con.send(JSON.stringify(payload));
            }
            generateQuote()
        }

        //client join message
        if (result.method === "join") {
            const clientId = result.clientId;
            const gameId = result.gameId;
            const playerName = result.playerName;
            const game = games[gameId];
            const playAgain = result.playAgain? true : false; 

            if (game.entry && !playAgain) {
                const color = { "0": "#552619", "1": "#c83f5f", "2": "#144058", "3": "#B6E696", "4": "#355952" }[game.clients.length]
                // console.log(game.clients.length + "game clients")
                game.clients.push({
                    "clientId": clientId,
                    "playerName": playerName,
                    "color": color,
                    "admin": false,
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
                    //bulk response
                    clients[c.clientId].connection.send(JSON.stringify(payload))
                })
            } else if(playAgain) {
                async function generateQuote() {
                    quote = await randomQuotes()
            
                    game.clients.forEach(c => {
                        // c.admin = result.adminStatus; 
                        c.progress = 0;
                        c.score = 0;
                    })
                    game.entry = true;
                    game.displayText = quote;

                    game.clients.forEach(c => {
                        const payload = {
                            "method": "join",
                            "game": game,
                            "admin": c.admin,
                            "quote": quote
                        }
                        //bulk response
                        clients[c.clientId].connection.send(JSON.stringify(payload))
                    })
                }
                generateQuote()
            } else {
                const payload = {
                    "method": "invalid entry",
                    "game": game,

                }
                // console.log("server sent invalid entry")
                clients[clientId].connection.send(JSON.stringify(payload))
            }
        }

        //client start message when every one is ready to play and now game will start on all screens at the same time
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
                    }
                    // bulk response to all clients to start the game
                    clients[c.clientId].connection.send(JSON.stringify(payload))
                })
            }
        }

        // client progress bar message where each client recieve progress status of all other clients
        if (result.method === "progress") {
            const clientId = result.clientId
            const gameId = result.gameId
            const game = games[gameId]
            const progress = result.progress
            game.clients.forEach(c => {
                if (c.clientId === clientId) {
                    //updating progress status of each client
                    c.progress = progress 
                }
            })

            const payload = {
                "method": "progress",
                "game": game
            }
            game.clients.forEach(c => {
                //bulk response to all clients with latest progress status of everyone
                clients[c.clientId].connection.send(JSON.stringify(payload))
            })
        }

        // client progress complete message that it has finished typing
        if (result.method === "progress completed") {
            const clientId = result.clientId
            const gameId = result.gameId
            const game = games[gameId]
            const accuracy = result.accuracy //client accuracy record
            const duration = result.duration //client duration to type completely

            //constants to calculate score
            const w1 = 0.5
            const w2 = 0.5
            //score calculation 
            const score = (w1 * accuracy) + (w2 * (1 / duration) * 1000)
            
            game.clients.forEach(c => {
                if (c.clientId === clientId) {
                    // current results of those who have completed 
                    c.score = score
                }
            })

            const payload = {
                "method": "result",
                "game": game
            }

            game.clients.forEach(c => {
                //bulk response of updated result stored in 'game' object
                clients[c.clientId].connection.send(JSON.stringify(payload))
            })
        }
    });

    // unique game Id
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

//functions for guid
function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring()
}

const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4()).substring()