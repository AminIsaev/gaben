#!/usr/bin/env node

/**
 * Script to fetch ALL Steam deals and cache them to a JSON file
 * Uses Steam special offers pages to get discounted games
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const STEAM_API_KEY = process.env.STEAM_API_KEY || '4EA6FC72CD2D41BD23DA659676B159FF';
const OUTPUT_FILE = path.join(__dirname, 'steam-deals.json');

// Currencies we want to support
const CURRENCIES = ['US', 'UA', 'RU'];

// Function to fetch JSON from URL
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Fetch game details for all currencies
async function fetchGameDetailsForAllCurrencies(appId) {
    const gameData = {
        id: appId,
        prices: {}
    };

    let baseInfoStored = false;

    // Fetch details for each currency
    for (const country of CURRENCIES) {
        const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${country}&l=english`;
        try {
            const data = await fetchJSON(url);
            const appData = data[appId];

            if (appData?.success) {
                const game = appData.data;
                const priceInfo = game.price_overview || {};

                // Store base info from first successful request
                if (!baseInfoStored) {
                    gameData.name = game.name;
                    gameData.header_image = game.header_image;
                    gameData.short_description = game.short_description;
                    gameData.detailed_description = game.detailed_description;
                    gameData.genres = game.genres?.map(g => g.description) || [];
                    gameData.developers = game.developers || [];
                    gameData.publishers = game.publishers || [];
                    gameData.release_date = game.release_date?.date || '';
                    gameData.metacritic = game.metacritic?.score || 0;
                    gameData.recommendations = game.recommendations?.total || 0;
                    gameData.positive_reviews = game.positive_reviews || 0;
                    gameData.total_reviews = game.total_reviews || 0;
                    gameData.url = `https://store.steampowered.com/app/${appId}`;
                    gameData.type = game.type;
                    gameData.is_free = game.is_free;
                    gameData.platforms = game.platforms || {};
                    gameData.categories = game.categories?.map(c => c.description) || [];
                    baseInfoStored = true;
                }

                // Store price info for this currency
                gameData.prices[country] = {
                    discount_percent: priceInfo.discount_percent || 0,
                    initial_formatted: priceInfo.initial_formatted || '',
                    final_formatted: priceInfo.final_formatted || '',
                    initial: priceInfo.initial || 0,
                    final: priceInfo.final || 0,
                    currency: priceInfo.currency || ''
                };
            }
        } catch (error) {
            // Silently fail for individual games
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    return gameData;
}

// Get all games from specials pages
async function getAllSpecials() {
    console.log('🔍 Fetching specials from Steam...');

    // Get featured specials
    const url = 'https://store.steampowered.com/api/featuredcategories?cc=US';
    const data = await fetchJSON(url);

    const allAppIds = new Set();

    // Get from specials
    if (data.specials?.items) {
        data.specials.items.forEach(item => allAppIds.add(item.id));
    }

    // Also check other categories that might have sales
    const categories = ['specials', 'top_sellers', 'new_releases', 'best_sellers'];

    for (const category of categories) {
        if (data[category]?.items) {
            data[category].items.forEach(item => {
                // Only add if it has a price shown (might be on sale)
                if (item.id) {
                    allAppIds.add(item.id);
                }
            });
        }
    }

    console.log(`📦 Found ${allAppIds.size} unique app IDs`);

    return Array.from(allAppIds);
}

async function main() {
    console.log('🎮 Starting Steam deals cache update...\n');

    const deals = [];

    // Get all app IDs from specials
    const appIds = await getAllSpecials();

    if (appIds.length === 0) {
        console.log('❌ No games found to process');
        return;
    }

    console.log(`\n🔍 Fetching details for ${appIds.length} games...\n`);

    // Process each game
    for (let i = 0; i < appIds.length; i++) {
        const appId = appIds[i];
        const progress = Math.round(((i + 1) / appIds.length) * 100);

        process.stdout.write(`\r   🔍 Processing: ${progress}% (${i + 1}/${appIds.length}) | Games with discounts: ${deals.length}`);

        // Fetch full details
        const gameDetails = await fetchGameDetailsForAllCurrencies(appId);

        // Check if ANY currency has a discount
        const hasDiscount = Object.values(gameDetails.prices).some(
            price => price.discount_percent > 0
        );

        if (hasDiscount) {
            gameDetails.popularityIndex = deals.length;
            deals.push(gameDetails);
        }
    }

    // Prepare cache data
    const cacheData = {
        lastUpdated: new Date().toISOString(),
        totalGames: deals.length,
        currencies: CURRENCIES,
        deals: deals
    };

    // Save to file
    console.log('\n\n💾 Saving to file...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cacheData, null, 2));

    console.log(`\n✨ Done! Cached data saved to ${OUTPUT_FILE}`);
    console.log(`📅 Last updated: ${cacheData.lastUpdated}`);
    console.log(`📊 Total games cached: ${cacheData.totalGames}`);
    console.log(`💰 Currencies: ${CURRENCIES.join(', ')}`);

    // Print sample of genres found
    const allGenres = new Set();
    deals.forEach(game => {
        game.genres?.forEach(g => allGenres.add(g));
    });
    console.log(`\n🏷️  Found ${allGenres.size} unique genres: ${Array.from(allGenres).slice(0, 10).join(', ')}${allGenres.size > 10 ? '...' : ''}`);

    // Print discount distribution
    const discountRanges = { '1-25%': 0, '26-50%': 0, '51-75%': 0, '76-100%': 0 };
    deals.forEach(game => {
        const maxDiscount = Math.max(...Object.values(game.prices).map(p => p.discount_percent));
        if (maxDiscount <= 25) discountRanges['1-25%']++;
        else if (maxDiscount <= 50) discountRanges['26-50%']++;
        else if (maxDiscount <= 75) discountRanges['51-75%']++;
        else discountRanges['76-100%']++;
    });
    console.log('\n💸 Discount distribution:');
    for (const [range, count] of Object.entries(discountRanges)) {
        console.log(`   ${range}: ${count} games`);
    }
}

main().catch(console.error);
