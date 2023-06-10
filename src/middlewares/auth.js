const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        
        if(!token) {
            throw new Error();
        }
        const decode = jwt.verify(token, 'random123');
        const user = await User.findOne({_id: decode._id, 'tokens.token': token});

        if(!user) {
            throw new Error();
        }
        req.user = user;
        req.token = token;
        next();
    } catch(err) {
        return res.status(400).send({'message': 'Authorization Error'});
    }

}

module.exports = auth;