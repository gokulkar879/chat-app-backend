if(process.env.NODE_ENV != 'production') {
    require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const auth = require('./middlewares/auth.js');
const Message = require('./models/Message');
const User = require('./models/User');
const cloudinary = require('./cloudinary.js');
require('./db.js');
const multer = require('multer');
const { Readable } = require('stream');
const upload = multer({
    limits: {
        fileSize: 1000000
    }
})

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors({credentials:true,origin:'https://glittery-piroshki-020ad0.netlify.app', methods: ['GET', 'PUT', 'POST', 'PATCH']}));
app.use(cookieParser());
app.use(express.json());


//helper for file uploads
async function uploadStream(buffer) {
    return new Promise((res, rej) => {
      const theTransformStream = cloudinary.uploader.upload_stream({
          folder: 'chatUser'
      },
        (err, result) => {
          if (err) return rej(err);
          res(result);
        }
      );
      let str = Readable.from(buffer);
      str.pipe(theTransformStream);
    });
}
async function uploadStreamChat(buffer) {
    return new Promise((res, rej) => {
      const theTransformStream = cloudinary.uploader.upload_stream({
          folder: 'chat'
      },
        (err, result) => {
          if (err) return rej(err);
          res(result);
        }
      );
      let str = Readable.from(buffer);
      str.pipe(theTransformStream);
    });
}



app.post('/', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        const token = await user.generateAuthToken();

        res.cookie('token', token, {httpOnly: true, secure: true, sameSite: 'none'})
           .send({user});
    } catch(err) {
        res.status(500).send({'message': 'error'});
    }
})

app.get('/', auth, async (req, res) => {
    res.send({user: req.user});
})

app.patch('/user', auth, upload.single('avatar'), async(req, res) => {
    const user = req.user;

    if(req.file) {
        const _res = await uploadStream(req.file.buffer);
        user.avatar = _res.secure_url;
    }
    try {
        const usr = await user.save();
        res.status(200).send({
            user: usr
        })

    } catch(err) {
        res.status(400).send({"message": "error"})
    }
})

const server = app.listen(PORT, () => {
    console.log(`Server running on port:${PORT}`)
})

const io = require('socket.io')(server, {
    cors: {
        credentials:true,
        origin:'https://glittery-piroshki-020ad0.netlify.app'
    }
});

const helper_unique = (users) => {
    let unique_users = {};
    let newArray = [];
    for(let i=0;i<users.length;i++) {
        unique_users[users[i].username] = users[i];
    }
    for (i in unique_users) {
        newArray.push(unique_users[i]);
    }
    // console.log(newArray);
    return newArray;
}

const helper_message = (messages) => {
    let new_messages = [];
    for(let i = 0; i < messages.length;i++) {
        new_messages.push({
            text: messages[i].text,
            _id: messages[i]._id,
            senderId: messages[i].senderId.username,
            recieverId: messages[i].recieverId.username,
            imageUrl: messages[i].imageUrl
        })
    }

    return new_messages;
}

io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    socket.username = username;
    next();
}).on('connection', (socket) => {
    
    const inital_users = () => {
        const username = socket.username;
        const users = [];
        for(let [id, socket] of io.of("/").sockets) {
            users.push({
                userId: id,
                username: socket.username
            })
        }
        socket.emit("get", socket.id)
        io.emit("users", helper_unique(users));
    }

    socket.on("sendMessage", async (data) => {
        
        const {text, from, to} = data;
        const senderId = await User.findOne({username: from});
        const recieverId = await User.findOne({username: to.username});

        const message = new Message({
            text: text,
            senderId: senderId,
            recieverId: recieverId
        })

        const msg = await message.save();
        console.log(to.userId)
        socket.to(to.userId).emit("recieveMessage", {_id: msg._id, text: text, senderId: from, recieverId: to.username});
    })

    socket.on("getMessages", async (data) => {
        const {from, to} = data;
        const sender = await User.findOne({username: from});
        const reciever = await User.findOne({username: to});
        const messages = await Message.find({$or: [
            {senderId: sender, recieverId: reciever}, {senderId: reciever, recieverId: sender}
        ]}).populate('senderId').populate('recieverId');
        
        socket.emit("recieveAllMessage", helper_message(messages));
    })

    socket.on("file", async (data) => {
        const {from, to, file} = data;
        try {

            const _res = await uploadStreamChat(file);

            const senderId = await User.findOne({username: from});
            const recieverId = await User.findOne({username: to.username});
    
            const message = new Message({
                text: "pic",
                imageUrl: _res.secure_url,
                senderId: senderId,
                recieverId: recieverId
            })
            await message.save();

            socket.to(to.userId).emit("recieveFile", {_id: message._id, imageUrl: message.imageUrl, senderId: from, recieverId: to.username});
        } catch(err) {
           console.log(err);
        }
    })

    inital_users();
})

// reader.readAsDataURL(ev.target.files[0]);
//     reader.onload = () => {
//       sendMessage(null, {
//         name: ev.target.files[0].name,
//         data: reader.result,
//       });
//     };