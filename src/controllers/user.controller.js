const { User, Order } = require('../models');
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
        const topSellers = await Order.aggregate([
            { $match: { deletedAt: null } }, // Ignore soft-deleted orders
            { $unwind: "$gigs" },
            {
                $group: {
                    _id: "$gigs.sellerID",
                    totalOrders: { $sum: 1 }
                }
            },
            { $sort: { totalOrders: -1 } },
            { $limit: 10 }, // Optional: top 10 sellers
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "seller"
                }
            },
            { $unwind: "$seller" },
            {
                $match: {
                    "seller.isSeller": true,
                    "seller.isVerified": true,
                    "seller.deletedAt": null
                }
            },
            {
                $project: {
                    _id: 0,
                    sellerID: "$_id",
                    totalOrders: 1,
                    username: "$seller.username",
                    email: "$seller.email",
                    country: "$seller.country",
                    image: "$seller.image",
                    description: "$seller.description"
                }
            }
        ]);


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