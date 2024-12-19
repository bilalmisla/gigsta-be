const jwt = require('jsonwebtoken');
const { CustomException } = require("../utils");

const authenticate = (request, response, next) => {
    // Check Authorization header first
    const authHeader = request.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    // Fallback to cookie
    const tokenFromCookie = request.cookies?.accessToken;

    // Use either token
    const token = tokenFromHeader || tokenFromCookie;

    try {
        if (!token) {
            throw CustomException('Access denied!', 401);
        }

        const verification = jwt.verify(token, process.env.JWT_SECRET);
        if(verification) {
            request.userID = verification._id;
            request.isSeller = verification.isSeller;
            return next();
        }

        throw CustomException('Access denied!', 401);
    }
    catch({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

module.exports = authenticate;