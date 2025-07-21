const { PaymentMethod, User } = require('../models');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

// Add a new IBAN payment method for seller
const addIbanPaymentMethod = async (req, res) => {
    try {
        const user = await User.findById(req.userID);
        if (!user.isSeller) {
            return res.status(403).send({ error: true, message: 'Only sellers can add payment methods.' });
        }

        const { iban, account_holder_name, country, currency } = req.body;
        if (!iban || !account_holder_name || !country || !currency) {
            return res.status(400).send({ error: true, message: 'Missing required fields.' });
        }

        // Create Stripe Customer for seller if not exists
        if (!user.stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.username
            });
            user.stripeCustomerId = customer.id;
            await user.save();
        }

        // Create PaymentMethod in Stripe
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'sepa_debit',
            sepa_debit: { iban },
            billing_details: {
                name: account_holder_name,
                email: user.email
            }
        });

        // Attach PaymentMethod to Customer
        await stripe.paymentMethods.attach(paymentMethod.id, {
            customer: user.stripeCustomerId
        });

        // Save in DB
        const pm = new PaymentMethod({
            user: user._id,
            stripeCustomerId: user.stripeCustomerId,
            stripePaymentMethodId: paymentMethod.id,
            iban,
            account_holder_name,
            country,
            currency,
            bank_name: paymentMethod.sepa_debit.bank_code || '',
            last4: paymentMethod.sepa_debit.last4,
            status: paymentMethod.sepa_debit.status // 'new', 'validated', etc.
        });
        await pm.save();

        return res.send({ error: false, message: 'IBAN added and verified with Stripe.', paymentMethod: pm });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message });
    }
};

// List all payment methods for seller
const listPaymentMethods = async (req, res) => {
    try {
        const methods = await PaymentMethod.find({ user: req.userID });
        return res.send({ error: false, paymentMethods: methods });
    } catch (error) {
        return res.status(500).send({ error: true, message: error.message });
    }
};

module.exports = { addIbanPaymentMethod, listPaymentMethods }; 