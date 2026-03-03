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
const DATABASE_FILE = path.join(__dirname, 'game-database.json');

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

// Load and save game database
function loadDatabase() {
    try {
        if (fs.existsSync(DATABASE_FILE)) {
            const data = fs.readFileSync(DATABASE_FILE, 'utf8');
            const db = JSON.parse(data);
            console.log(`   Loaded ${db.length} games from database`);
            return db;
        }
    } catch (error) {
        console.log('   No existing database, starting fresh');
    }
    return [];
}

function saveDatabase(db) {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(db, null, 2));
}

// Get all games from specials pages and database
async function getAllSpecials() {
    console.log('🔍 Fetching deals from Steam...');

    const allAppIds = new Set();

    // Load existing database
    let database = loadDatabase();

    // If database is empty or small, seed with popular games
    if (database.length < 1000) {
        console.log('   Seeding database with popular games...');

        // Comprehensive list of popular Steam games
        const seedGames = [
            // Major AAA titles
            271590, 1172380, 1174180, 1245620, 1091500, 1097840, 892970, 236430, 218620, 548430,
            1240440, 1593500, 294100, 251990, 582010, 578080, 427520, 381210, 365720, 239140,
            466560, 281990, 322330, 990080, 236390, 394360, 275850, 287290, 813780, 359550,
            632470, 570, 730, 440, 550, 236090, 221100, 374320, 252490, 252950, 346110,
            489830, 292030, 435150, 264710, 367520, 489830, 440900, 1086940, 582160, 601510,
            704280, 594650, 1118310, 1151640, 1091190, 1245620, 1172470, 12210, 12110, 8930,
            // Popular indie games
            105600, 220, 400, 332200, 250900, 323730, 418370, 252150, 250820, 357220,
            274190, 307690, 286090, 236090, 251570, 49520, 261550, 311210, 703080, 594650,
            319630, 457140, 254870, 245620, 271590, 12210, 312660, 232770, 230410, 107410,
            // More recent popular games
            1454860, 1385850, 1145350, 1449560, 1817070, 1096770, 1551360, 1623730, 1782210,
            1145360, 1096770, 1203620, 1966720, 1817190, 812140, 1091500, 614910, 704280,
            // Strategy/management
            255710, 394360, 466560, 289070, 290340, 236850, 281990, 294100, 990080, 427520,
            362550, 287290, 646570, 851850, 945360, 462770, 526870, 611990, 642880, 611970,
            466560, 310560, 359550, 284410, 383070, 418370, 457140, 462770, 466560, 548430,
            // RPGs
            367520, 1086940, 292030, 374320, 251990, 1151640, 1158310, 1240440, 236390,
            418370, 262060, 562480, 312660, 462770, 271590, 379430, 261550, 294100, 435150,
            // Action/Adventure
            218620, 230410, 252490, 582010, 107410, 440, 550, 252950, 346110, 548430,
            365720, 239140, 323730, 250900, 322330, 578080, 1118310, 594650, 1145350,
            // Simulation
            427520, 294100, 251990, 281990, 236430, 435150, 990080, 457140, 287290, 381210,
            739630, 1454860, 1097840, 1551360, 1385850, 1240440, 1817070, 1817190, 814380,
            // Casual/Co-op
            322330, 271590, 418370, 252150, 252950, 594650, 49520, 254870, 236090, 704280,
            264710, 286090, 245620, 274190, 307690, 311210, 365720, 394360, 239140, 236390,
            // Horror
            418370, 239140, 381210, 601510, 582160, 466560, 292030, 239140, 427520, 252950,
            // FPS
            730, 440, 550, 570, 218620, 230410, 252490, 252950, 346110, 374320,
            427520, 582010, 594650, 611970, 611990, 1097840, 1151640, 1174180, 1245620,
            // Racing
            251570, 286090, 365720, 457140, 582010, 632470, 704280, 1091500, 1151640, 12210,
            12110, 1551360, 284410, 287290, 319630, 346110, 367520, 394360, 435150, 440900,
            // Sports
            730, 252490, 252950, 346110, 365720, 427520, 457140, 582010, 594650, 632470,
            704280, 1091500, 1151640, 1174180, 1245620,
            // More diverse titles
            70, 80, 100, 120, 200, 210, 220, 230, 240, 250,
            300, 320, 330, 340, 350, 400, 410, 420, 430, 440,
            450, 500, 520, 530, 550, 600, 700, 800, 900, 1000,
            1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
        ];

        // Add seed games to database
        const beforeSize = database.length;
        seedGames.forEach(id => {
            if (id && !database.includes(id)) {
                database.push(id);
            }
        });

        // Remove duplicates and sort
        database = [...new Set(database)].sort((a, b) => a - b);
        saveDatabase(database);
        console.log(`   Seeded ${database.length - beforeSize} new games`);
    }

    // Add all games from database
    database.forEach(id => allAppIds.add(id));
    console.log(`   Database games: ${allAppIds.size}`);

    // Featured categories - games currently on sale
    const featuredUrl = 'https://store.steampowered.com/api/featuredcategories?cc=US';
    const featuredData = await fetchJSON(featuredUrl);

    const featuredCategories = ['specials', 'top_sellers', 'new_releases', 'best_sellers'];
    let newGamesFromFeatured = 0;
    for (const category of featuredCategories) {
        if (featuredData[category]?.items) {
            featuredData[category].items.forEach(item => {
                if (item.id) {
                    const isNew = !allAppIds.has(item.id);
                    allAppIds.add(item.id);
                    if (isNew) newGamesFromFeatured++;
                }
            });
        }
    }
    console.log(`   Featured categories: +${newGamesFromFeatured} new games (total: ${allAppIds.size})`);

    console.log(`\n📦 Total games to check: ${allAppIds.size}`);

    // Save updated database
    const sortedDatabase = Array.from(allAppIds).sort((a, b) => a - b);
    saveDatabase(sortedDatabase);
    console.log(`💾 Database updated with ${sortedDatabase.length} games\n`);

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
