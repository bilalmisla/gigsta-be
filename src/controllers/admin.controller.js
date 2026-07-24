const { fetchAdminDashboardCounts } = require('../utils/adminDashboard');
const { assertAdmin } = require('../utils/orderHelpers');

const getDashboardCounts = async (req, res) => {
    try {
        await assertAdmin(req.userID);
        const data = await fetchAdminDashboardCounts();
        return res.send({ error: false, data });
    } catch (error) {
        console.error('getDashboardCounts error:', error);
        return res.status(error.status || 500).send({
            error: true,
            message: error.message || 'Internal server error.'
        });
    }
};

module.exports = { getDashboardCounts };
