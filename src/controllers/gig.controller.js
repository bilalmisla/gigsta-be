const { Gig } = require('../models');
const { CustomException } = require('../utils');

const createGig = async (request, response) => {
    try {
        // console.log(request, "dasda");
        // if (!request.isSeller) {
        //     throw CustomException('Only sellers can create new Gigs!', 403);
        // }

        const gig = new Gig({
            userID: request.userID,
            ...request.body
        });
        await gig.save();
        return response.status(201).send(gig);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const updateGig = async (request, response) => {
    const { _id } = request.params;
    try {
        const result = await Gig.updateOne({ _id }, { $set: { ...request.body } });
        return response.status(201).send(result);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const deleteGig = async (request, response) => {
    const { _id } = request.params;

    try {
        const gig = await Gig.findOne({ _id });
        if (request.userID === gig.userID.toString()) {
            await Gig.deleteOne({ _id });
            return response.send({
                error: false,
                message: 'Gig has been successfully deleted!'
            })
        }

        throw CustomException('Invalid request! Cannot delete other user gigs!', 403);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const getGig = async (request, response) => {
    const { _id } = request.params;

    try {
        const gig = await Gig.findOne({ _id }).populate('userID', 'username country image createdAt email description');
        if (!gig) {
            throw CustomException('Gig not found!', 404);
        }
        return response.send(gig);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const getGigs = async (request, response) => {
    const { category, search, max, min, userID, sort } = request.query;
    try {
        const filters = {
            ...(userID && { userID }),
            ...(category && { category: { $regex: category, $options: 'i' } }),
            ...(search && { title: { $regex: search, $options: 'i' } }),
            ...((min || max) && {
                price: {
                    ...(max && { $lte: max }),
                    ...(min && { $gte: min }),
                },
            })
        }

        const gigs = await Gig.find(filters).sort({ [sort]: -1 }).populate('userID', 'username cover email description isSeller _id image');
        return response.send(gigs);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

module.exports = {
    createGig,
    deleteGig,
    getGig,
    getGigs,
    updateGig
}