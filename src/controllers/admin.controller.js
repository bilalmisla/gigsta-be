const { User, Order, Gig } = require('../models');

const getDashboardCounts = async (req, res) => {
    try {
        // Ensure only admin can access
        const requester = await User.findById(req.userID);
        if (!requester || requester.role !== 'admin') {
            return res.status(403).send({ error: true, message: 'Forbidden: admin role required.' });
        }

        const totalUsers = await User.countDocuments({ deletedAt: null });
        const totalSellers = await User.countDocuments({ isSeller: true, deletedAt: null });
        const totalBuyers = totalUsers - totalSellers;
        const ordersCount = await Order.countDocuments({ deletedAt: null });
        const activeGigs = await Gig.countDocuments({ deletedAt: null });

        const revenueAgg = await Order.aggregate([
            { $match: { deletedAt: null, isCompleted: true } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueAgg.length ? revenueAgg[0].totalRevenue : 0;

        return res.send({ error: false, data: { totalUsers, totalSellers, totalBuyers, ordersCount, activeGigs, totalRevenue } });
    } catch (error) {
        console.error('getDashboardCounts error:', error);
        return res.status(500).send({ error: true, message: error.message || 'Internal server error.' });
    }
};

module.exports = { getDashboardCounts };
