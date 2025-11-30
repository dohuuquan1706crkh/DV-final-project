const width = Math.max(document.documentElement.clientWidth || 960, 960);
const height = Math.max(document.documentElement.clientHeight || 600, 600);

const svg = d3.select('#map')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', '100%')
    .style('display', 'block');

const g = svg.append('g');

const projection = d3.geoNaturalEarth1()
    .scale((width / 1.8) / Math.PI)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);
const tooltip = d3.select('#tooltip');
const GEOJSON_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';

let countriesData = [];

d3.json(GEOJSON_URL).then(world => {
    countriesData = world.features;
    drawMap(world);
}).catch(err => {
    console.error('Failed to load GeoJSON:', err);
    svg.append('text').attr('x',20).attr('y',30).text('Failed to load world GeoJSON');
});

function drawMap(world) {
    g.selectAll('path')
    .data(world.features)
    .enter().append('path')
        .attr('class', 'country')
        .attr('d', path)
        .on('mouseover', (event, d) => {
        tooltip.style('display', 'block').text(d.properties.name || 'Unknown');
        d3.select(event.currentTarget).raise();
        })
        .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX) + 'px')
                .style('top', (event.pageY) + 'px');
        })
        .on('mouseout', () => tooltip.style('display', 'none'))
        .on('click', (event, d) => {
        // Redirect to another page for the country
        const countryName = d.properties.name;
        window.location.href = `country.html?name=${encodeURIComponent(countryName)}`;
        });

    const graticule = d3.geoGraticule();
    g.append('path')
    .datum(graticule)
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#cfcfcf')
    .attr('stroke-width', 0.5);
}

// Zoom & pan
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
    g.attr('transform', event.transform);
    });
svg.call(zoom);

d3.select('#reset').on('click', () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));
d3.select('#zoomIn').on('click', () => svg.transition().duration(350).call(zoom.scaleBy, 1.4));
d3.select('#zoomOut').on('click', () => svg.transition().duration(350).call(zoom.scaleBy, 1/1.4));

// Search feature
const searchInput = d3.select('#searchBar');
searchInput.on('keyup', (event) => {
    if (event.key === 'Enter') {
    const query = searchInput.property('value').toLowerCase();
    const country = countriesData.find(d => (d.properties.name || '').toLowerCase() === query);
    if (country) {
        const [[x0, y0], [x1, y1]] = path.bounds(country);
        const dx = x1 - x0, dy = y1 - y0;
        const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
        const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    } else {
        alert('Country not found');
    }
    }
});