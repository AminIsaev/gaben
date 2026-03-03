// Steam API Configuration
const STEAM_API_KEY = '4EA6FC72CD2D41BD23DA659676B159FF';

// State
let currentLang = 'en';
let currentCurrency = 'USD';

// Currency symbols
const currencySymbols = {
    USD: '$',
    UAH: '₴',
    RUB: '₽'
};

// Country codes for Steam API
const currencyCountries = {
    USD: 'US',
    UAH: 'UA',
    RUB: 'RU'
};

// Translations
const translations = {
    en: {
        title: 'Steam Deals',
        loading: 'Loading deals...',
        error: 'Failed to load deals. Please try again later.',
        discount: '-{discount}%'
    },
    ru: {
        title: 'Скидки Steam',
        loading: 'Загрузка скидок...',
        error: 'Не удалось загрузить скидки. Попробуйте позже.',
        discount: '-{discount}%'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupLanguageSelector();
    setupCurrencySelector();
    loadDeals();
});

// Language selector
function setupLanguageSelector() {
    const langBtns = document.querySelectorAll('.lang-btn');

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLang = btn.dataset.lang;
            updateTranslations();
        });
    });
}

// Currency selector
function setupCurrencySelector() {
    const currencySelect = document.getElementById('currency-select');

    currencySelect.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        loadDeals();
    });
}

// Update translations
function updateTranslations() {
    const elements = document.querySelectorAll('[data-translate]');
    const lang = translations[currentLang];

    elements.forEach(el => {
        const key = el.dataset.translate;
        if (lang[key]) {
            el.textContent = lang[key];
        }
    });
}

// Load deals from Steam
async function loadDeals() {
    const loadingEl = document.getElementById('loading');
    const gridEl = document.getElementById('deals-grid');

    loadingEl.style.display = 'flex';
    gridEl.innerHTML = '';

    try {
        // Get featured categories from Steam
        const response = await fetch(
            `https://store.steampowered.com/api/featuredcategories?cc=${currencyCountries[currentCurrency]}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch deals');
        }

        const data = await response.json();
        const specials = data.specials?.items || [];

        // Get detailed info for each game
        const deals = await Promise.all(
            specials.slice(0, 20).map(item => getGameDetails(item.id))
        );

        // Filter only games with discounts
        const discountedGames = deals.filter(game => game && game.discount > 0);

        displayDeals(discountedGames);
    } catch (error) {
        console.error('Error loading deals:', error);
        gridEl.innerHTML = `<p style="text-align: center; color: #8f98a0;">${translations[currentLang].error}</p>`;
    } finally {
        loadingEl.style.display = 'none';
    }
}

// Get game details
async function getGameDetails(appId) {
    try {
        const response = await fetch(
            `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${currencyCountries[currentCurrency]}`
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const gameData = data[appId];

        if (!gameData?.success) {
            return null;
        }

        const game = gameData.data;
        const priceInfo = game.price_overview || {};

        return {
            id: appId,
            name: game.name,
            image: game.header_image,
            discount: priceInfo.discount_percent || 0,
            originalPrice: priceInfo.initial_formatted || '',
            finalPrice: priceInfo.final_formatted || '',
            url: `https://store.steampowered.com/app/${appId}`
        };
    } catch (error) {
        console.error(`Error fetching details for app ${appId}:`, error);
        return null;
    }
}

// Display deals
function displayDeals(deals) {
    const gridEl = document.getElementById('deals-grid');

    if (deals.length === 0) {
        gridEl.innerHTML = `<p style="text-align: center; color: #8f98a0;">${translations[currentLang].error}</p>`;
        return;
    }

    deals.forEach(game => {
        const card = createDealCard(game);
        gridEl.appendChild(card);
    });
}

// Create deal card
function createDealCard(game) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.onclick = () => window.open(game.url, '_blank');

    const discountText = translations[currentLang].discount.replace('{discount}', game.discount);

    card.innerHTML = `
        <img src="${game.image}" alt="${game.name}" loading="lazy">
        <div class="deal-info">
            <h3 class="deal-title">${game.name}</h3>
            <div class="deal-price">
                <span class="discount-badge">${discountText}</span>
                <div class="prices">
                    ${game.originalPrice ? `<span class="original-price">${game.originalPrice}</span>` : ''}
                    <span class="final-price">${game.finalPrice}</span>
                </div>
            </div>
        </div>
    `;

    return card;
}
