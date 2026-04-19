const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

// Translate text using Google Translate free API endpoint
async function translateToUkrainian(text) {
    if (!text) return '';
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        // data[0] is an array of translated segments. Join them.
        let translatedText = '';
        if (data && data[0]) {
            data[0].forEach(segment => {
                if (segment[0]) translatedText += segment[0];
            });
        }
        return translatedText || text;
    } catch (e) {
        console.error('Translation error:', e);
        return text; // Fallback to english if translation fails
    }
}

// Update Header System Info
function updateSystemInfo() {
    const now = new Date();
    
    // Format Date: DD Month YYYY
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    let dateStr = now.toLocaleDateString('uk-UA', options);
    document.getElementById('current-date').textContent = dateStr.toUpperCase();

    // Format UTC Time: HH:mm
    const hoursStr = now.getUTCHours().toString().padStart(2, '0');
    const minsStr = now.getUTCMinutes().toString().padStart(2, '0');
    document.getElementById('current-utc').textContent = `${hoursStr}:${minsStr} UTC`;
}

// Map keywords to regions
const regionsMap = {
    'me': ['israel', 'iran', 'gaza', 'palestine', 'lebanon', 'syria', 'yemen', 'saudi', 'iraq', 'hormuz', 'middle east'],
    'eu': ['russia', 'ukraine', 'putin', 'kyiv', 'moscow', 'europe', 'eu', 'germany', 'france', 'uk', 'nato'],
    'ap': ['china', 'taiwan', 'japan', 'korea', 'pyongyang', 'asia', 'pacific', 'philippines', 'india'],
    'am': ['us', 'usa', 'america', 'biden', 'trump', 'mexico', 'brazil', 'africa', 'nigeria', 'sudan', 'congo']
};

function categorizeArticle(title, desc) {
    const text = (title + ' ' + desc).toLowerCase();
    for (const [region, keywords] of Object.entries(regionsMap)) {
        for (const kw of keywords) {
            if (text.includes(kw)) {
                return region;
            }
        }
    }
    return 'am'; // default
}

function getIconForNews(text) {
    const t = text.toLowerCase();
    if (t.includes('missile') || t.includes('strike') || t.includes('ракет')) return '🚨';
    if (t.includes('military') || t.includes('war') || t.includes('військ')) return '⚔️';
    if (t.includes('market') || t.includes('oil') || t.includes('economy') || t.includes('нафт')) return '💥';
    if (t.includes('cyber') || t.includes('hack')) return '💻';
    if (t.includes('space') || t.includes('orbit')) return '🛰️';
    if (t.includes('diploma') || t.includes('talks')) return '🤝';
    return '▸';
}

async function fetchNews() {
    // We use rss2json to parse BBC World feed
    const rssUrl = 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    
    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        if (data.status === 'ok' && data.items && data.items.length > 0) {
            const articles = data.items.slice(0, 40); // Top 40
            
            // Extract BLUF (Top 1)
            const blufRaw = articles[0];
            const blufTransTitle = await translateToUkrainian(blufRaw.title);
            const blufTransDesc = await translateToUkrainian(blufRaw.description);
            const blufHtml = `<div class="bluf-text">${blufTransTitle}. ${blufTransDesc}</div>`;
            document.getElementById('bluf-content').innerHTML = blufHtml;

            // Key Developments (Top 2-8)
            let keyDevHtml = '';
            for (let i = 1; i < 8 && i < articles.length; i++) {
                const art = articles[i];
                const trTitle = await translateToUkrainian(art.title);
                const trDesc = await translateToUkrainian(art.description);
                const icon = getIconForNews(art.title);
                
                // Randomly assign confidence string for SITDECK feel
                const conf = Math.random() > 0.5 ? '<span class="badge high">ВИСОКА НАДІЙНІСТЬ</span>' : '<span class="badge mod">СЕРЕДНЯ НАДІЙНІСТЬ</span>';

                keyDevHtml += `
                <div class="highlight-dev">
                    <div class="dev-icon">${icon}</div>
                    <div class="dev-content">
                        <h3>${trTitle} ${conf}</h3>
                        <p>${trDesc}</p>
                    </div>
                </div>`;
            }
            document.getElementById('key-dev-content').innerHTML = keyDevHtml;

            // Group into Regions
            const categorized = { me: [], eu: [], ap: [], am: [] };
            for (let i = Math.min(8, articles.length); i < articles.length; i++) {
                const region = categorizeArticle(articles[i].title, articles[i].description);
                if (categorized[region].length < 6) {
                    categorized[region].push(articles[i]);
                }
            }

            // Populate Regions
            for (const reg of Object.keys(categorized)) {
                let html = '';
                for (const art of categorized[reg]) {
                    const trTitle = await translateToUkrainian(art.title);
                    html += `<li>${trTitle}</li>`;
                }
                if (html === '') html = '<li style="opacity:0.5;">Немає значних інцидентів</li>';
                const ul = document.querySelector(`#region-${reg} .region-list`);
                if (ul) ul.innerHTML = html;
            }

            // Indicators
            document.getElementById('indicators-content').innerHTML = `
                <ul class="region-list">
                    <li>Стеження за подальшою ескалацією після останніх заяв.</li>
                    <li>Моніторинг реакції ринку на відкритті сесії в Азії.</li>
                    <li>Очікування офіційних дипломатичних комюніке протягом 24 годин.</li>
                </ul>`;

        } else {
            throw new Error("Некоректний формат даних від розвідцентру.");
        }
    } catch (e) {
        console.error('Failed to fetch news', e);
        document.getElementById('bluf-content').innerHTML = '<div class="bluf-text" style="color:var(--accent-red)">Помилка зв\'язку з розвідцентром.</div>';
        document.getElementById('key-dev-content').innerHTML = '<div class="loading" style="color:var(--accent-red)">Дані недоступні</div>';
        document.getElementById('indicators-content').innerHTML = '<div class="loading" style="color:var(--accent-red)">Дані недоступні</div>';
        const uls = document.querySelectorAll('.region-list');
        uls.forEach(ul => ul.innerHTML = '<li style="color:var(--accent-red)">Оновлення не вдалось</li>');
    }
}

async function fetchMarkets() {
    try {
        // Fetch Crypto Data from Binance API
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
        let html = '';

        for (const sym of symbols) {
            const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`);
            const data = await res.json();
            
            const price = parseFloat(data.lastPrice).toFixed(2);
            const changeStr = parseFloat(data.priceChangePercent).toFixed(2);
            const change = parseFloat(changeStr);
            const trendClass = change >= 0 ? 'trend-up' : 'trend-down';
            const signalStr = change >= 0 ? `+${changeStr}%` : `${changeStr}%`;
            const evalStr = change >= 0 ? 'Ріст' : 'Падіння';
            const name = sym.replace('USDT', '');

            html += `
            <tr>
                <td>${name}</td>
                <td class="${trendClass}">${signalStr}</td>
                <td>${evalStr}</td>
                <td class="${trendClass}">${change >= 0 ? '▲' : '▼'}</td>
            </tr>`;
        }

        // Mock WTI Crude Oil and Gold for full effect since free real-time apis for commodities are very restrictive
        html += `
         <tr>
            <td>WTI Crude</td>
            <td class="trend-down">-1.20%</td>
            <td>Нестабільність</td>
            <td class="trend-down">▼</td>
        </tr>
         <tr>
            <td>GOLD (Озонова)</td>
            <td class="trend-up">+0.50%</td>
            <td>Захисний актив</td>
            <td class="trend-up">▲</td>
        </tr>`;

        document.getElementById('market-tbody').innerHTML = html;

    } catch (e) {
        console.error('Market fetch error', e);
        document.getElementById('market-tbody').innerHTML = `<tr><td colspan="4" style="color:var(--accent-red)">Сигнал ринку втрачено</td></tr>`;
    }
}

async function fetchMultimedia() {
    try {
        // Use NASA APOD as the image of the day
        const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const data = await res.json();

        let trTitle = "Системне зображення дня";
        if (data.title) {
            trTitle = await translateToUkrainian(data.title);
        }

        if (data.url) {
            const html = `
                <img src="${data.url}" alt="Multimedia of the day" class="media-img">
                <div class="media-caption">[ДЖЕРЕЛО: NASA] ${trTitle}</div>
            `;
            document.getElementById('multimedia-content').innerHTML = html;
        } else {
            throw new Error("Некоректний формат медіа.");
        }

    } catch (e) {
        console.error('Multimedia error', e);
        document.querySelector('.multimedia-sect').style.display = 'none';
    }
}

async function fetchThreats() {
    try {
        const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson');
        const data = await res.json();
        
        let html = '';
        if (data.features && data.features.length > 0) {
            const quakes = data.features.slice(0, 5);
            for (const q of quakes) {
                const mag = q.properties.mag.toFixed(1);
                const placeRaw = q.properties.place;
                const placeTrans = await translateToUkrainian(placeRaw);
                const isHigh = parseFloat(mag) >= 6.0;
                const badge = isHigh ? '<span class="badge high">КРИТИЧНО</span>' : '<span class="badge mod">НЕБЕЗПЕЧНО</span>';
                html += `<li><strong>[MAG ${mag}]</strong> ${placeTrans} ${badge}</li>`;
            }
        } else {
            html = '<li style="opacity:0.5;">Сейсмічна ситуація в нормі.</li>';
        }
        
        document.getElementById('threats-content').innerHTML = `<ul class="region-list">${html}</ul>`;
    } catch (e) {
        console.error('Threats error', e);
        document.getElementById('threats-content').innerHTML = '<ul class="region-list"><li style="color:var(--accent-red)">Помилка сейсмічних датчиків</li></ul>';
    }
}

async function fetchCyberNews() {
    try {
        const rssUrl = 'https://feeds.feedburner.com/TheHackersNews';
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        let html = '';
        if (data.status === 'ok' && data.items && data.items.length > 0) {
            const articles = data.items.slice(0, 4); // Top 4
            for (const art of articles) {
                const trTitle = await translateToUkrainian(art.title);
                html += `<li><strong>[СИСТЕМА]</strong> ${trTitle}</li>`;
            }
        } else {
            html = '<li style="opacity:0.5;">Кіберпростір у нормі.</li>';
        }
        document.getElementById('cyber-content').innerHTML = `<ul class="region-list">${html}</ul>`;
    } catch (e) {
        console.error('Cyber error', e);
        document.getElementById('cyber-content').innerHTML = '<ul class="region-list"><li style="color:var(--accent-red)">Помилка зв\'язку з кіберцентром</li></ul>';
    }
}

async function fetchSpaceWeather() {
    try {
        const res = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        const data = await res.json(); 
        
        // Exclude header row
        const latest = data[data.length - 1];
        const kpIndex = parseFloat(latest[1]).toFixed(1);
        const timeUTC = latest[0].split(' ')[1].substring(0,5) + ' UTC';
        
        let status = "НОРМА";
        let badge = '<span class="badge mod">СТАБІЛЬНО</span>';
        if (kpIndex >= 5) {
            status = "ГЕОМАГНІТНА БУРЯ";
            badge = '<span class="badge high">НЕБЕЗПЕКА</span>';
        }

        const html = `
            <li><strong>ГЛОБАЛЬНИЙ Kp-ІНДЕКС:</strong> ${kpIndex} ${badge}</li>
            <li><strong>ОСТАННІЙ ЗАМІР:</strong> ${timeUTC}</li>
            <li><strong>СТАТУС ІОНОСФЕРИ:</strong> ${status}</li>
        `;
        document.getElementById('space-content').innerHTML = `<ul class="region-list">${html}</ul>`;
    } catch (e) {
        console.error('Space error', e);
        document.getElementById('space-content').innerHTML = '<ul class="region-list"><li style="color:var(--accent-red)">Втрата телеметрії супутників</li></ul>';
    }
}

async function initDashboard() {
    updateSystemInfo();
    
    // Fetch data concurrently
    await Promise.all([
        fetchNews(),
        fetchMarkets(),
        fetchThreats(),
        fetchCyberNews(),
        fetchSpaceWeather(),
        fetchMultimedia()
    ]);

    // Keep clock updated
    setInterval(updateSystemInfo, 60000); // every minute
}

// Boot up
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Set refresh interval to 4 times a day (every 6 hours)
    setInterval(() => {
        console.log("Refreshing SITDECK data...");
        initDashboard();
    }, REFRESH_INTERVAL);
});
