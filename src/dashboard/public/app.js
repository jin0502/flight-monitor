document.addEventListener('DOMContentLoaded', () => {
    const addRouteForm = document.getElementById('add-route-form');
    const routesUl = document.getElementById('routes-ul');
    const routeSelector = document.getElementById('route-selector');
    const priceTrendCanvas = document.getElementById('price-trend-chart');
    const priceHeatmapCanvas = document.getElementById('price-heatmap-chart');
    
    const destinationCountrySelect = document.getElementById('destination-country');
    const destinationManualInput = document.getElementById('destination');
    const destinationTypeInput = document.getElementById('destination_type');

    let priceTrendChart;
    let priceHeatmapChart;

    // Fetch countries to populate dropdown
    async function fetchCountries() {
        try {
            const response = await fetch('/api/countries');
            const countries = await response.json();
            
            // Find the custom option and insert before it
            const customOption = destinationCountrySelect.querySelector('option[value="custom"]');
            
            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                destinationCountrySelect.insertBefore(option, customOption);
            });
        } catch (error) {
            console.error('Error fetching countries:', error);
        }
    }

    // Handle country select change
    destinationCountrySelect.addEventListener('change', () => {
        if (destinationCountrySelect.value === 'custom') {
            destinationManualInput.style.display = 'block';
            destinationManualInput.required = true;
            destinationTypeInput.value = 'airport';
        } else {
            destinationManualInput.style.display = 'none';
            destinationManualInput.required = false;
            destinationTypeInput.value = 'country';
        }
    });

    // Fetch and display monitored routes
    async function fetchRoutes() {
        try {
            const response = await fetch('/api/routes');
            const routes = await response.json();
            
            // Populate list
            routesUl.innerHTML = '';
            routeSelector.innerHTML = '<option value="">-- Choose a route --</option>';
            
            routes.forEach(route => {
                const li = document.createElement('li');
                li.className = 'route-card';
                li.innerHTML = `
                    <div class="route-info">
                        <strong>${route.origin} &rarr; ${route.destination}</strong>
                        <span>Type: <b>${route.destination_type || 'country'}</b></span>
                        <span>${route.region} | ${route.search_type}</span>
                        <span>Threshold: <b>¥${route.alert_threshold || 'None'}</b></span>
                    </div>
                    <button class="btn-delete" data-id="${route.id}">Delete</button>
                `;
                routesUl.appendChild(li);

                const option = document.createElement('option');
                option.value = route.id;
                option.textContent = `${route.origin} to ${route.destination} (${route.search_type})`;
                routeSelector.appendChild(option);
            });

            // Add delete event listeners
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this route?')) {
                        await deleteRoute(id);
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching routes:', error);
        }
    }

    // Add new route
    addRouteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addRouteForm);
        
        let destination = formData.get('destination_country');
        if (destination === 'custom') {
            destination = formData.get('destination');
        }

        const data = {
            origin: formData.get('origin'),
            destination: destination,
            destination_type: formData.get('destination_type'),
            region: formData.get('region'),
            search_type: formData.get('search_type'),
            alert_threshold: formData.get('alert_threshold') ? parseFloat(formData.get('alert_threshold')) : null
        };

        try {
            const response = await fetch('/api/routes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                addRouteForm.reset();
                destinationManualInput.style.display = 'none';
                destinationManualInput.required = false;
                destinationTypeInput.value = 'country';
                await fetchRoutes();
            } else {
                const err = await response.json();
                alert('Error: ' + err.error);
            }
        } catch (error) {
            console.error('Error adding route:', error);
        }
    });

    // Delete route
    async function deleteRoute(id) {
        try {
            const response = await fetch(`/api/routes/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchRoutes();
            } else {
                const err = await response.json();
                alert('Error: ' + err.error);
            }
        } catch (error) {
            console.error('Error deleting route:', error);
        }
    }

    // Handle route selection and chart updates
    routeSelector.addEventListener('change', async (e) => {
        const routeId = e.target.value;
        if (!routeId) {
            if (priceTrendChart) priceTrendChart.destroy();
            if (priceHeatmapChart) priceHeatmapChart.destroy();
            return;
        }

        try {
            const response = await fetch(`/api/prices/${routeId}`);
            const prices = await response.json();
            updateCharts(prices);
        } catch (error) {
            console.error('Error fetching price history:', error);
        }
    });

    function updateCharts(data) {
        if (priceTrendChart) priceTrendChart.destroy();
        if (priceHeatmapChart) priceHeatmapChart.destroy();

        if (data.length === 0) {
            alert('No price data available for this route.');
            return;
        }

        // 1. Price Trend Chart: Min price over scrape_date
        const trendData = {};
        data.forEach(item => {
            const date = item.scrape_date.split('T')[0]; // ISO date part
            if (!trendData[date] || item.price < trendData[date]) {
                trendData[date] = item.price;
            }
        });

        const sortedDates = Object.keys(trendData).sort();
        const trendValues = sortedDates.map(date => trendData[date]);

        priceTrendChart = new Chart(priceTrendCanvas, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Minimum Price Found (CNY)',
                    data: trendValues,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: false, title: { display: true, text: 'Price (CNY)' } },
                    x: { title: { display: true, text: 'Scrape Date' } }
                }
            }
        });

        // 2. Price "Heatmap" using Scatter chart
        const heatmapData = data.map(item => ({
            x: new Date(item.travel_date).getTime(),
            y: new Date(item.scrape_date).getTime(),
            price: item.price,
            flight: item.flight_number,
            time: item.departure_time
        }));

        const minPrice = Math.min(...data.map(d => d.price));
        const maxPrice = Math.max(...data.map(d => d.price));

        function getPriceColor(price) {
            const ratio = (price - minPrice) / (maxPrice - minPrice || 1);
            const r = Math.floor(255 * ratio);
            const g = Math.floor(255 * (1 - ratio));
            return `rgba(${r}, ${g}, 0, 0.7)`;
        }

        priceHeatmapChart = new Chart(priceHeatmapCanvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Price Points (Click for details)',
                    data: heatmapData,
                    pointBackgroundColor: heatmapData.map(d => getPriceColor(d.price)),
                    pointRadius: 8,
                    pointStyle: 'rect'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Travel Date' },
                        ticks: { callback: (value) => new Date(value).toLocaleDateString() }
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: 'Scrape Date' },
                        ticks: { callback: (value) => new Date(value).toLocaleDateString() }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const d = context.raw;
                                return `Price: ¥${d.price} | Flight: ${d.flight} | Time: ${d.time} | Travel: ${new Date(d.x).toLocaleDateString()}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Initial load
    fetchCountries();
    fetchRoutes();
});
