//EXPRESS
const app = require('express')();
const http = require("http").createServer(app);

//ENV
const PORT = 4000;
const clientDomain = "https://p3l6p.csb.app";

//CORS
// set up cors to allow us to accept requests from our client
const cors = require("cors");
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    //allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // allow session cookie from browser to pass through
  })
);
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
})

//SOCKET IO
const io = require('socket.io')(http, {
  cors: {
    origin: clientDomain,
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

//BODYPARSER
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//LOGGER
//setting up basic middleware for all Express requests
const logger = require('morgan');
app.use(logger('dev')); // Log requests to API using morgan

app.get('/', (req, res) => {
  var responseText = 'Hello World!<br>'
  responseText += '<small>Requested at: ' + req.requestTime + '</small>'
  res.send(responseText)
});

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



//IO ROOMS
//suppose to store on db
let ROOMSLIST = [{
    name: 'Global',
    participants: 0,
    _id: 1,
    sockets: [],
    messages: []
}, {
    name: 'Funny',
    participants: 0,
    _id: 2,
    sockets: [],
    messages: []
}, {
    name: 'Animals',
    participants: 0,
    _id: 3,
    sockets: [],
    messages: []
}];

app.get('/getRoomsList', (req, res) => {
    console.log("Getting RoomsList...")
    res.json({
        roomslist: ROOMSLIST
    })
});

app.post('/getRoomData', (req, res) => {
    console.log("Getting getRoomData...")
    let room = ""
    for(let e of ROOMSLIST) {
      if(e._id === req.body._id) {
        room = e
      }
    }
    res.json({
        room: room
    })
});

//IO CONNECTIONS
// socket object may be used to send specific messages to the new connected client
io.on('connection', (socket) => { 
    
    //New client connected
    console.log('new client connected');
    socket.emit('connection', null);

    //User joined a Room
    socket.on('join-room', roomID => {
      console.log('User [', socket.id, '] joined room #', roomID);
      socket.join(roomID)

      socket.broadcast
      .to(roomID)
      .emit('receive-message', {username: "", user_message: "An user has joined the room."});
      
      //Remove Sockets from previous rooms
      for(let e of socket.rooms.keys()) {
        if(typeof e === "number" && e !== roomID) {
          socket.leave(e)
          socket.broadcast
          .to(e)
          .emit('receive-message', {username: "", user_message: "An user has left the room."});
        }
      }

      ROOMSLIST.forEach(e => {
            if (e._id === roomID) {
              //Add socket.id into ROOMSLIST
              if (e.sockets.indexOf(socket.id) === -1) {
                  e.sockets.push(socket.id);
                  e.participants++;
              }
            } else {
              //Remove socket.id from ROOMSLIST
              let index = e.sockets.indexOf(socket.id);
              if (index !== -1) {
                  e.sockets.splice(index, 1);
                  e.participants--;
              }
            }
        });
    })

    //Users send message
    socket.on('new-message', (data) => {
      let { roomID, msgObj } = data
      console.log(roomID)
      console.log(msgObj)
      ROOMSLIST.forEach(e => {
            if (e._id === roomID) {
              e.messages.push(msgObj)
            }
        });      
      socket.broadcast
      .to(roomID)
      .emit('receive-message', msgObj);
    });

    //User left a room
    socket.on('leave-room', (roomID) => {
        console.log('User [', socket.id, '] left room #', roomID);

        //Remove Sockets from previous rooms
        for(let e of socket.rooms.keys()) {
            socket.leave(e)
        }

        socket.broadcast
        .to(roomID)
        .emit('receive-message', {username: "", user_message: "An user has left the room."});

        ROOMSLIST.forEach(e => {
            //Remove socket.id from ROOMSLIST
            let index = e.sockets.indexOf(socket.id);
            if (index !== -1) {
                e.sockets.splice(index, 1);
                e.participants--;
            }
        });
    });  

    //User Disconnected
    socket.on('disconnect', () => {
        console.log('User [', socket.id, '] has disconnected.');

        //Remove Sockets from previous rooms
        for(let e of socket.rooms.keys()) {
            socket.leave(e)
        }

        ROOMSLIST.forEach(e => {
            //Remove socket.id from ROOMSLIST
            let index = e.sockets.indexOf(socket.id);

            for(let s of e.sockets) {
              if(s === socket.id) {
                socket.broadcast
                .to(e._id)
                .emit('receive-message', {username: "", user_message: "An user has left the room."});
              }
            }

            if (index !== -1) {
                e.sockets.splice(index, 1);
                e.participants--;
            }
        });
    });    
});