const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        type: String
    },
    contacts: [
        {
            contact: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        }
    ],
    tokens: [
        {
            token: {
                type: String,
                required: true
            }
        }
    ]
});


//hashing the plain text password

UserSchema.pre('save', async function(next) {
    const user = this;
    if(user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 5);
    }

    next();
})

//generate auth token
UserSchema.methods.generateAuthToken = async function() {
    const user = this;

    const token = jwt.sign({_id: user._id.toString()}, process.env.JWT);
    user.tokens.push({token});
    await user.save();

    return token;
}

//find a user by credentials
UserSchema.statics.getUserByCredentials = async (username, password) => {
    const user = await User.findOne({username});

    if(!user) {
        throw new Error('unable to login');
    }
    const isMatch = await bcrypt.compare(password, user.password);

    if(isMatch) {
        return user;
    }

    throw new Error('unable to login');
}

module.exports = mongoose.model('User', UserSchema);

