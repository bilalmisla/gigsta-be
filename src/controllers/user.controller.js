const { default: mongoose } = require('mongoose');
const { User, Order, Withdrawal, OrderStatus, PaymentMethod } = require('../models');
const { CustomException } = require('../utils');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const nodemailer = require('nodemailer');
const { sendAdminWithdrawalNotificationEmail } = require('../utils/emailTemplates');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const deleteUser = async (request, response) => {
    const { _id } = request.params;

    try {
        const user = await User.findOne({ _id });

        if (request.userID === user._id.toString()) {
            await User.deleteOne({ _id });
            return response.send({
                error: false,
                message: 'Account successfully deleted!'
            });
        }

        throw CustomException('Invalid request!. Cannot delete other user accounts.', 403);
    }
    catch ({ message, status = 500 }) {
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
                    description: "$seller.description",
                    tagline: "$seller.tagline",
                    address: "$seller.address",
                    postalCode: "$seller.postalCode",
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

const createStripeAccountLink = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller) {
            return res.status(403).send({ error: true, message: 'Only sellers can onboard with Stripe.' });
        }

        // Create Stripe account if not exists
        if (!user.stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                email: user.email,
                capabilities: { transfers: { requested: true }, card_payments: { requested: true } }
            });
            user.stripeAccountId = account.id;
            await user.save();
        }

        // Create account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: user.stripeAccountId,
            refresh_url: `${process.env.FRONTEND_URL}/account`,
            return_url: `${process.env.FRONTEND_URL}/account`,
            type: 'account_onboarding',
        });

        return res.send({ url: accountLink.url });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message });
    }
};

const addSellerIban = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller) {
            return res.status(400).send({ error: true, message: 'Only seller can withdraw his amount.' });
        }

        const { accountHolderName, routingNumber, accountNumber, accountType, amount, statuses } = req.body;
        if (!accountHolderName || !routingNumber || !accountNumber) {
            return res.status(400).send({ error: true, message: 'Missing required fields.' });
        }

        const withdraw = await Withdrawal.create({
            sellerID: user._id,
            amount,
            type: 'manual',
            status: 'pending',
            country: user.country || 'pk',
            accountHolderName,
            routingNumber, accountNumber, accountType
        });

        if (Array.isArray(statuses) && statuses.length > 0) {
            await OrderStatus.updateMany(
                { _id: { $in: statuses.map(id => new mongoose.Types.ObjectId(id._id)) } },
                { $set: { withdrawn: true } }
            );
        }

        await sendAdminWithdrawalNotificationEmail(
            process.env.EMAIL_USER,
            {
                fullName: user.fullname,
                email: user.email,
                address: user.address,
                postalCode: user.postalCode,
                country: user.country.toUpperCase() || 'pk',
                state: user.state,
                accountHolderName,
                routingNumber, accountNumber, accountType,
                amount,
                requestId: withdraw._id,
                requestedAt: withdraw.createdAt
            },
            transporter
        );

        return res.send({
            error: false,
            message: 'Withdrawal processed successfully.',
            withdraw
        });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message });
    }
};

const withdrawSellerFunds = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller || !user.stripeAccountId) {
            return res.status(403).send({ error: true, message: 'Seller account with Stripe Connect required.' });
        }

        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).send({ error: true, message: 'Valid amount is required for withdrawal.' });
        }

        await Withdrawal.create({
            seller: user._id,
            amount,
            stripeTransferId: transfer.id,
            status: 'completed',
        });

        return res.send({
            error: false,
            message: 'Withdrawal processed successfully.',
            transfer
        });

    } catch (error) {
        return res.status(500).send({
            error: true,
            message: error.message || 'Internal server error during withdrawal.'
        });
    }
};

// Convert seller to agency
const convertToAgency = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (!user.isSeller) return res.status(400).json({ message: "Only sellers can convert" });

        // If already agency
        if (user.sellerType === "agency") {
            return res.status(400).json({ message: "Already an agency" });
        }

        user.sellerType = "agency";
        await user.save();

        res.json({ message: "Profile converted to Agency successfully", user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Convert seller to agency
const convertToSeller = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (!user.isSeller) return res.status(400).json({ message: "Only sellers can convert" });

        // If already agency
        if (user.sellerType !== "agency") {
            return res.status(400).json({ message: "You are not an agency" });
        }

        user.sellerType = null;
        user.agencyId = null;
        await user.save();

        res.json({ message: "Profile converted back to Seller successfully", user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    deleteUser, fetchTopSellers, createStripeAccountLink, 
    addSellerIban, withdrawSellerFunds, convertToAgency, convertToSeller
}

