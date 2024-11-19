const { shortRegionClient } = require('../../../utils/generalClients.js');
const { regions, regionMapping } = require('../../../utils/regionData.js');

const fetchSummonerIds = async (rank) => {
    const allSummonerIds = await Promise.all(
        regions.map(async (region) => {
            const client = shortRegionClient(region);
            const response = await client.get(`/tft/league/v1/${rank}`);
            const players = response.data.entries.slice(0, 1);
            return players.map(player => ({ summonerId: player.summonerId, region }));
        })
    );
    return allSummonerIds.flat();
};

const fetchSummonerPuuids = async (summonerData) => {
    const summonerPuuid = await Promise.all(
        summonerData.map(async ({ summonerId, region }) => {
            const client = shortRegionClient(region);
            const response = await client.get(`/tft/summoner/v1/summoners/${summonerId}`);
            return { puuid: response.data.puuid, region };
        })
    );
    return summonerPuuid.flat();
};

const fetchMatchHistory = async (puuids) => {
    const puuidMatchHistory = await Promise.all(
        puuids.map(async ({ puuid, region }) => {
            const matchRegion = regionMapping[region];
            const client = shortRegionClient(matchRegion);
            const response = await client.get(`/tft/match/v1/matches/by-puuid/${puuid}/ids`);
            return response.data.slice(0, 1).map(matchId => ({ matchId, region: matchRegion }));
        })
    );
    return puuidMatchHistory.flat();
};

const fetchMatchDetails = async (matchIds) => {
    const matchDetailsPromises = matchIds.map(({ matchId, region }) => {
        const client = shortRegionClient(region);
        return client.get(`/tft/match/v1/matches/${matchId}`);
    });
    const matchDetailsResponses = await Promise.all(matchDetailsPromises);
    return matchDetailsResponses.map(response => response.data);
};

const processPlayerData = (matchDetails) => {
    const playerData = matchDetails.flatMap(response =>
        response.info.participants.map(participant => ({
            placement: participant.placement,
            units: participant.units.map(unit => ({
                character_id: unit.character_id,
                items: unit.itemNames,
                tier: unit.tier
            }))
        }))
    );
    return playerData;
};

const calculateChampionData = (playerData) => {
    const championData = playerData.reduce((acc, player) => {
        player.units.forEach(unit => {
            if (acc[unit.character_id]) {
                acc[unit.character_id].totalGames += 1;
                acc[unit.character_id].placements.push(player.placement);
                if (player.placement === 1) {
                    acc[unit.character_id].wins += 1;
                }
            } else {
                acc[unit.character_id] = {
                    totalGames: 1,
                    placements: [player.placement],
                    wins: player.placement <= 4 ? 1 : 0
                };
            }
        });
        return acc;
    }, {});
    return championData;
};

const calculateChampionRanking = (championData) => {
    const championRanking = Object.entries(championData).map(([championId, { totalGames, wins, placements }]) => ({
        championId,
        winrate: ((wins / totalGames) * 100).toFixed(2),
        placement: (placements.reduce((sum, p) => sum + p, 0) / totalGames).toFixed(2)
    }));
    return championRanking.sort((a, b) => a.placement - b.placement);
};

const getChampionData = async (rank) => {
    try {
        const summonerIds = await fetchSummonerIds(rank);
        if (summonerIds.length === 0) throw new Error(`No ${rank} players found`);

        const summonerPuuids = await fetchSummonerPuuids(summonerIds);
        if (summonerPuuids.length === 0) throw new Error(`No ${rank} players found`);

        const matchHistory = await fetchMatchHistory(summonerPuuids);
        if (matchHistory.length === 0) throw new Error(`No ${rank} matches found`);

        const matchDetails = await fetchMatchDetails(matchHistory);
        if (matchDetails.length === 0) throw new Error(`No ${rank} match details found`);

        const playerData = processPlayerData(matchDetails);
        if (playerData.length === 0) throw new Error(`No ${rank} player data found`);

        const championData = calculateChampionData(playerData);
        const championRanking = calculateChampionRanking(championData);

        return championRanking;
    } catch (error) {
        console.error(`Error fetching ${rank} data:`, error.message);
        throw new Error(`Error fetching ${rank} data: ${error.message}`);
    }
};

module.exports = getChampionData;