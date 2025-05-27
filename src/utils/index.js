const CustomException = require('./CustomException');
const { default: axios } = require('axios');

const formatTimestamp = () => {
    const now = new Date();

    // Format options
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Karachi', // PKT (Pakistan Standard Time)
        timeZoneName: 'short'
    };

    const dateOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Karachi'
    };

    const timeFormatter = new Intl.DateTimeFormat('en-US', options);
    const dateFormatter = new Intl.DateTimeFormat('en-US', dateOptions);

    const time = timeFormatter.format(now).replace('GMT+5', 'PKT'); // optional: replace time zone label
    const date = dateFormatter.format(now);

    return `${time}, ${date}`;
};

async function fetchFileBuffer(fileUrl) {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const fileName = fileUrl.split('/').pop(); // or however you parse the name
    return {
      filename: fileName,
      content: Buffer.from(response.data),
    };
}

module.exports = {
    formatTimestamp,
    CustomException,
    fetchFileBuffer
}