const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RIOT_API_KEY = process.env.RIOT_API_KEY;

const fullRegionClient = (region) => {
    return axios.create({
        baseURL: `https://${region}.api.riotgames.com`,
        headers: {
            'X-Riot-Token': RIOT_API_KEY
        }
    })
};

const shortRegionClient = (region) => {
    return axios.create({
        baseURL:`https://${region}.api.riotgames.com`,
        headers: {
            'X-Riot-Token': RIOT_API_KEY
        }
    })
};

console.log(RIOT_API_KEY)
module.exports = fullRegionClient;