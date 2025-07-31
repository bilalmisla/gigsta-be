const { Order, OrderStatus } = require('../models');

/**
 * Calculates the seller's availableFunds, futurePayments, and totalEarnings
 * using your OrderStatus and Order data, matching your getEarningStats logic.
 *
 * @param {String} userID - Seller's MongoDB _id string
 * @returns {Promise<{ availableFunds: number, futurePayments: number, totalEarnings: number, eligibleStatusIds: string[] }>}
 */
const calculateSellerAvailableFunds = async (userID) => {
    const orderStatuses = await OrderStatus.find({ sellerID: userID, deletedAt: null });

    const latestStatusMap = {};
    orderStatuses.forEach(status => {
        const key = `${status.orderID}_${status.gigID}`;
        if (!latestStatusMap[key] || new Date(status.createdAt) > new Date(latestStatusMap[key].createdAt)) {
            latestStatusMap[key] = status;
        }
    });

    let availableFunds = 0;
    let futurePayments = 0;
    let totalEarnings = 0;
    const eligibleStatusIds = [];

    const orderIDs = Array.from(new Set(Object.values(latestStatusMap).map(s => s.orderID)));
    const orders = await Order.find({ _id: { $in: orderIDs } });
    const orderMap = new Map();
    orders.forEach(order => orderMap.set(order._id.toString(), order));

    Object.values(latestStatusMap).forEach(status => {
        const order = orderMap.get(status.orderID?.toString());
        if (!order) return;
        const gigItem = order.gigs.find(g =>
            g.gigID.toString() === status.gigID.toString() &&
            g.sellerID.toString() === userID.toString()
        );
        if (!gigItem) return;

        const amount = gigItem.total || gigItem.price || 0;

        if (status.status === 'Completed' && !status.withdrawn) {
            availableFunds += amount;
            totalEarnings += amount;
            eligibleStatusIds.push(status._id);
        } else if (status.status === 'Completed' && status.withdrawn) {
            totalEarnings += amount;
        } else {
            futurePayments += amount;
        }
    });

    return { availableFunds, futurePayments, totalEarnings, eligibleStatusIds };
};

module.exports = calculateSellerAvailableFunds;
