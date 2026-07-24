const { User, Order, Gig } = require('../models');

/**
 * Aggregate platform-level counts for the admin dashboard.
 */
const fetchAdminDashboardCounts = async () => {
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

    return { totalUsers, totalSellers, totalBuyers, ordersCount, activeGigs, totalRevenue };
};

module.exports = { fetchAdminDashboardCounts };
