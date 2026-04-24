document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    // Refresh data every 5 minutes
    setInterval(loadDashboardData, 5 * 60 * 1000);
});

async function loadDashboardData() {
    try {
        const [oneway, combinations] = await Promise.all([
            fetch('/api/oneway').then(res => res.json()),
            fetch('/api/combinations').then(res => res.json())
        ]);

        renderStats(oneway, combinations);
        renderTopDeals(combinations);
        renderFlightsTable(oneway);
        
    } catch (err) {
        console.error('Error loading dashboard data:', err);
    }
}

function renderStats(oneway, combinations) {
    const totalCombos = document.getElementById('stat-total-combos');
    const topDeal = document.getElementById('stat-top-deal');
    const lastScan = document.getElementById('stat-last-scan');

    if (totalCombos) totalCombos.textContent = combinations.length;
    
    if (combinations.length > 0) {
        const best = combinations[0];
        if (topDeal) topDeal.textContent = `¥${best.total_price}`;
        
        const lastDate = new Date(best.created_at);
        if (lastScan) lastScan.textContent = lastDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

function renderTopDeals(combinations) {
    const container = document.getElementById('deals-container');
    if (!container) return;
    container.innerHTML = '';

    if (combinations.length === 0) {
        container.innerHTML = '<div class="deal-card">No combinations found yet. Run a scan to see results.</div>';
        return;
    }

    // Show top 6 deals
    combinations.slice(0, 6).forEach(deal => {
        const card = document.createElement('div');
        card.className = 'deal-card';
        
        card.innerHTML = `
            <div class="deal-header">
                <span class="badge badge-direct">${deal.destination_code}</span>
                <span class="deal-price">¥${deal.total_price}</span>
            </div>
            <div class="deal-route">
                <div class="flight-info">
                    <div class="flight-dot outbound-dot"></div>
                    <div>
                        <div style="font-weight: 600;">PVG ✈️ ${deal.destination_code}</div>
                        <div class="flight-details">
                            <span>${deal.out_date} ${deal.out_time}</span>
                            <span>${deal.out_fn}</span>
                        </div>
                    </div>
                </div>
                <div class="flight-info">
                    <div class="flight-dot return-dot"></div>
                    <div>
                        <div style="font-weight: 600;">${deal.destination_code} ✈️ PVG</div>
                        <div class="flight-details">
                            <span>${deal.ret_date} ${deal.ret_time}</span>
                            <span>${deal.ret_fn}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--text-muted); text-align: center;">
                ${deal.gap_days} Day Trip
            </div>
        `;
        container.appendChild(card);
    });
}

function renderFlightsTable(oneway) {
    const body = document.getElementById('flights-body');
    if (!body) return;
    body.innerHTML = '';

    oneway.slice(0, 50).forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${f.origin} ✈️ ${f.destination}</td>
            <td>${f.flight_date} ${f.departure_time}</td>
            <td style="font-weight: 700; color: #818cf8;">¥${f.price}</td>
            <td>${f.airline} (${f.flight_number})</td>
            <td><span class="badge badge-direct">Direct</span></td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${f.scrape_date.split('T')[0]}</td>
        `;
        body.appendChild(tr);
    });
}
