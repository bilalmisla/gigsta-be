const jwt = require('jsonwebtoken');
const { CustomException } = require("../utils");

const authenticate = (request, response, next) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw CustomException('Token missing or invalid!', 401);
    }

    const token = authHeader.split(' ')[1];
    try {
        const verification = jwt.verify(token, process.env.JWT_SECRET);
        request.userID = verification._id;
        request.token = token;
        return next();
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

module.exports = authenticate;
