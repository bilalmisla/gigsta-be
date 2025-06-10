const { User } = require('../models');
const { CustomException } = require('../utils');

const deleteUser = async (request, response) => {
    const { _id } = request.params;

    try {
        const user = await User.findOne({ _id });

        if(request.userID === user._id.toString()) {
            await User.deleteOne({ _id });
            return response.send({
                error: false,
                message: 'Account successfully deleted!'
            });
        }

        throw CustomException('Invalid request!. Cannot delete other user accounts.', 403);
    }
    catch({message, status = 500}) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const fetchTopSellers = async (request, response) => {
    try {
        // Fetch only users who are sellers and verified (soft deletion is automatically handled by pre hook)
        const topSellers = await User.find({ isSeller: true, isVerified: true })
            .sort({ createdAt: -1 }) // or sort by rating or totalSales if you add those
            .limit(10); // to limit the result to top 10

        return response.send({
            error: false,
            success: true,
            data: topSellers,
            message: 'Top sellers fetched successfully.'
        });
    } catch (error) {
        const { message, status = 500 } = error;
        return response.status(status).send({
            error: true,
            success: false,
            message
        });
    }
};

module.exports = {
    deleteUser, fetchTopSellers
}