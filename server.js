const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const shortid = require('shortid')

const Player = require('./models/Player');
const Leaderboard = require('./models/Leaderboard');

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let players = []
let sockets = []
let rooms = new Map();
let leaderboard = new Map();
let completedGames = new Map();

io.sockets.on('connection', (socket) => {

  let player = new Player();
  let playerId = player.playerid;

  players[playerId] = player;
  sockets[playerId] = socket;
  console.log("player connected");

  socket.emit("register", {playerId})

  socket.on('disconnect', () => {
    //see if disconnecting player occurs inside his room if so delete him
    console.log("player disconnected");
    if(rooms[player.roomid]) {
      rooms[player.roomid] = rooms[player.roomid].filter(function(p) {
        return p.playerid !== player.playerid;
      })
      io.in(player.roomid).emit("playerschanged", {players: rooms[player.roomid]})
    }

    //if the room the player was in is now empty delete the room
    if(rooms[player.roomid] && rooms[player.roomid].length < 1) {
      rooms.delete(player.roomid)
      delete rooms[player.roomid]
    }

    //clean up the player elsewhere
    delete players[playerId];
    delete sockets[playerId]
  })

  socket.on('create', (data) => {
    //generate a room id
    const roomid = shortid.generate();

    //update the current socket user 
    player.username = data.username;
    player.roomid = roomid;

    //join the socket room and emit event that notifies the client
    socket.join(roomid)
    socket.emit("roomjoined", {roomid, player})

    //add the player to the rooms map
    rooms[roomid] = [player]
    socket.emit("playerschanged", {players: rooms[roomid]})
    io.in(roomid).emit("gamecompleted", {games: completedGames[roomid]})
    console.log("roomid: ", roomid);
    console.log("roomid: ", rooms[roomid]);
  });

  socket.on('join', (data) => {
    //retreive the data
    var { username } = data
    var { roomid } = data

    //if the user is not currently in the room then add him
    if(rooms[roomid] && !rooms[roomid].includes(player) && rooms[roomid].length < 9)
    {
      player.username = username;
      player.roomid = roomid;
      socket.join(roomid)
      socket.emit("roomjoined", {roomid, player}) 
      
      //if user joins an existing room then spread add the user to the array
      //else instantiate an array and at the user to it
        if(rooms[roomid])
          rooms[roomid] = [...rooms[roomid], player]
        else
          rooms[roomid] = [player]

        io.in(roomid).emit("playerschanged", {players: rooms[roomid]})

        console.log("players: ", rooms[roomid]);
    } else {
      socket.emit("error", {message: "Kamer is vol!"}) 
    }
  });

  socket.on('score', (data) => {
    let { score, username, playerid, gameid, roomid } = data;
    if(!leaderboard[roomid]) {
      leaderboard[roomid] = new Leaderboard();
    }
    var roomBoard = leaderboard[data.roomid].games[data.gameid];
    if(roomBoard && roomBoard.playerid === player.playerid && roomBoard.gameid === gameid)
      return
    
    roomBoard = !roomBoard ? [{score, username, playerid}] : [...roomBoard, {score, username, playerid}];
    roomBoard.sort((a,b) => {
      return  b.score - a.score
    })

    leaderboard[roomid].games[gameid] = roomBoard;
    console.log("scores = ", leaderboard[data.roomid].games);
    io.in(roomid).emit("scoreupdated", {leaderboard: leaderboard[data.roomid].games})

    if(IsCompleted(gameid, leaderboard[data.roomid].games, roomid)) {
      console.log("a game has been completed: ", gameid);
      
      completedGames[roomid] = completedGames[roomid] ? [...completedGames[roomid], {gameid}] : [gameid]
      io.in(roomid).emit("gamecompleted", {games: completedGames[roomid]})
    }
  });
});

const IsCompleted = (gameid, scores, roomid) => {
  if(scores[gameid] && rooms[roomid] && scores[gameid].length >= rooms[roomid].length) {
    return true;
  }
  return false;
}

http.listen(3000, () => {
  console.log('listening on *:3000');
});