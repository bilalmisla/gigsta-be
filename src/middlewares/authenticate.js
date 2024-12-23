const jwt = require('jsonwebtoken');
const { CustomException } = require("../utils");

const authenticate = (request, response, next) => {
    const { accessToken } = request.cookies;
    console.log(accessToken, "accessToken");
    
    try {
        if (!accessToken) {
            throw CustomException('Access denied!', 401)
        }

        const verification = jwt.verify(accessToken, process.env.JWT_SECRET);
        console.log(verification, process.env.JWT_SECRET, "verification");
        if(verification) {
            request.userID = verification._id;
            console.log("etstsetsete");
            return next();
        }

        throw CustomException('Access denied!', 401);
    }
    catch(error) {
        console.log("error from middleware", error);
        
        return response.status(error.status).send({
            error: true,
            message: error.message
        })
    }
}

module.exports = authenticate;