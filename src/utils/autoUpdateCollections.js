const { User, Gig, Order, Message, Review, Conversation, PaymentMethod, OrderStatus, Withdrawal } = require("../models");

const models = [
    { name: 'User', model: User },
    { name: 'Gig', model: Gig },
    { name: 'Order', model: Order },
    { name: 'Message', model: Message },
    { name: 'Review', model: Review },
    { name: 'Conversation', model: Conversation },
    { name: 'PaymentMethod', model: PaymentMethod },
    { name: 'OrderStatus', model: OrderStatus },
    { name: 'Withdrawal', model: Withdrawal }
];

async function autoUpdateCollections() {
    for (const { name, model } of models) {
        const schemaPaths = model.schema.paths;

        const update = {};
        for (const path in schemaPaths) {
            if (path === '_id' || path === '__v') continue;

            const schemaType = schemaPaths[path];
            let defaultValue = schemaType.defaultValue;

            // If no explicit default, set as null
            if (defaultValue === undefined) defaultValue = null;

            // Use $cond to only set if the field is missing
            // update[path] = { $cond: [{ $eq: [`$${path}`, undefined] }, defaultValue, `$${path}`] };
            update[path] = {
                $cond: [
                    { $eq: [ { $type: `$${path}` }, "missing" ] },
                    defaultValue,
                    `$${path}`
                ]
            };
        }

        try {
            const result = await model.updateMany(
                {},
                [
                    { $set: update }
                ]
            );
            console.log(`✅ ${name}: Updated ${result.modifiedCount} documents with missing fields.`);
        } catch (error) {
            console.error(`❌ ${name}: Failed to update documents.`, error);
        }
    }
}

module.exports = autoUpdateCollections;
