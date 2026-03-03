#!/usr/bin/env node

/**
 * Script to fetch Steam deals and cache them to a JSON file
 * Run this with GitHub Actions or locally
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const STEAM_API_KEY = process.env.STEAM_API_KEY || '4EA6FC72CD2D41BD23DA659676B159FF';
const OUTPUT_FILE = path.join(__dirname, 'steam-deals.json');

// Currencies to cache
const currencies = ['US', 'UA', 'RU'];

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

async function fetchGameDetails(appId, countryCode) {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${countryCode}`;
    try {
        const data = await fetchJSON(url);
        const gameData = data[appId];

        if (!gameData?.success) {
            return null;
        }

        const game = gameData.data;
        const priceInfo = game.price_overview || {};

        return {
            id: appId,
            name: game.name,
            header_image: game.header_image,
            discount_percent: priceInfo.discount_percent || 0,
            initial_formatted: priceInfo.initial_formatted || '',
            final_formatted: priceInfo.final_formatted || '',
            recommendations: game.recommendations?.total || 0,
            positive_reviews: game.positive_reviews || 0,
            total_reviews: game.total_reviews || 0,
            url: `https://store.steampowered.com/app/${appId}`
        };
    } catch (error) {
        console.error(`Error fetching details for app ${appId}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('🎮 Starting Steam deals cache update...');

    const cacheData = {
        lastUpdated: new Date().toISOString(),
        deals: {}
    };

    for (const country of currencies) {
        console.log(`\n📍 Processing ${country}...`);

        try {
            // Fetch featured categories
            const featuredUrl = `https://store.steampowered.com/api/featuredcategories?cc=${country}`;
            const featuredData = await fetchJSON(featuredUrl);
            const specials = featuredData.specials?.items || [];

            console.log(`   Found ${specials.length} items on sale`);

            if (specials.length === 0) {
                console.log(`   No specials found for ${country}`);
                continue;
            }

            // Fetch details for each game (limit to first 50 to avoid rate limits)
            const deals = [];
            const limit = Math.min(specials.length, 50);

            for (let i = 0; i < limit; i++) {
                const item = specials[i];
                const progress = Math.round(((i + 1) / limit) * 100);

                process.stdout.write(`\r   Loading: ${progress}% (${i + 1}/${limit})`);

                const gameDetails = await fetchGameDetails(item.id, country);

                if (gameDetails && gameDetails.discount_percent > 0) {
                    deals.push({
                        ...gameDetails,
                        popularityIndex: i
                    });
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`\n   ✅ Cached ${deals.length} discounted games`);
            cacheData.deals[country] = deals;

        } catch (error) {
            console.error(`   ❌ Error processing ${country}:`, error.message);
            cacheData.deals[country] = [];
        }
    }

    // Save to file
    console.log('\n💾 Saving to file...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cacheData, null, 2));

    console.log(`\n✨ Done! Cached data saved to ${OUTPUT_FILE}`);
    console.log(`📅 Last updated: ${cacheData.lastUpdated}`);

    // Print summary
    console.log('\n📊 Summary:');
    for (const [country, deals] of Object.entries(cacheData.deals)) {
        console.log(`   ${country}: ${deals.length} games`);
    }
}

main().catch(console.error);
