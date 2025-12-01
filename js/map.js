const ctx = {};

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

// ----------------------------------------
// Draw gdp
// ----------------------------------------

Promise.all([
    loadWDIcsv("data/Economy/Economy_GDP (current US$).csv"),
    loadWDIcsv("data/Economy/Economy_GDP growth (annual _).csv")
]).then(([gdpData, growthData]) => {
    ctx.gdpData = gdpData;
    ctx.growthData = growthData;

    drawScatterForYear(2020);   // ví dụ chọn năm 2020
});

function drawScatterForYear(year) {
    const svg = d3.select("#scatterSvg");
    svg.selectAll("*").remove();

    const yearStr = String(year);

    // Merge dữ liệu theo Country Code
    const merged = [];

    ctx.gdpData.forEach(g => {
        const code = g["Country Code"];
        const growthRow = ctx.growthData.find(d => d["Country Code"] === code);
        if (!growthRow) return;

        let gdp = +g[yearStr];
        let growth = +growthRow[yearStr];

        if (gdp == 0) return;     // elimate value with 0 gdp

        merged.push({
            name: g["Country Name"],
            code: code,
            gdp: gdp,
            growth: growth
        });
    });

    // Setup scale
    const width = 900;
    const height = 800;
    const margin = {top: 40, right: 40, bottom: 60, left: 80};

    console.log(merged);

    const x = d3.scaleLog()   // GDP scale dạng log cho đẹp
        .domain(d3.extent(merged, d => d.gdp))
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(merged, d => d.growth))
        .range([height - margin.bottom, margin.top]);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(10, "~s"));

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    // Labels
    svg.append("text")
        .attr("x", width/2)
        .attr("y", height - 15)
        .attr("text-anchor", "middle")
        .text(`GDP (current US$), year ${year}`);

    svg.append("text")
        .attr("x", -height/2)
        .attr("y", 20)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .text(`GDP growth %, year ${year}`);

    svg.append("text")
        .attr("x", width / 2)      // căn giữa theo chiều ngang
        .attr("y", 25)             // cách trên SVG 25px
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .text(`Scatter plot of GDP vs GDP growth, year ${year}`);

    const defs = svg.append("defs");

    svg.selectAll("g.flagPoint")
        .data(merged)
        .enter()
        .each(function (d) {
            const cx = x(d.gdp);
            const cy = y(d.growth);
            const r = 8;

            // tạo clipPath
            defs.append("clipPath")
                .attr("id", `clip-${d.code}`)
                .append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", r);

            // vẽ flag
            svg.append("image")
                .attr("href", flagURL(d.code))
                .attr("x", cx - r)
                .attr("y", cy - r)
                .attr("width", r * 2)
                .attr("height", r * 2)
                .attr("clip-path", `url(#clip-${d.code})`)
                .attr("preserveAspectRatio", "xMidYMid slice")
                .append("title")  // thêm title
                .text(`${d.name}\nGDP: ${d.gdp}\nGrowth: ${d.growth}`);;

            // viền trắng
            svg.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", r)
                .attr("fill", "none")
                .attr("stroke", "gray")
                .attr("stroke-width", 1.5);
        });
}

// ----------------------------------------
// Process file
// ----------------------------------------

async function loadWDIcsv(url) {
    const raw = await d3.text(url);

    // Tách thành từng dòng
    const lines = raw.split(/\r?\n/);

    // Tìm dòng header thực sự: dòng bắt đầu bằng "Country Name"
    const headerIndex = lines.findIndex(line =>
        line.startsWith('"Country Name"')
    );

    // Lấy phần CSV sạch kể từ dòng header
    const cleanCSV = lines.slice(headerIndex).join("\n");

    // Parse bằng d3.csvParse
    return d3.csvParse(cleanCSV);
}

document.getElementById("updateBtn").addEventListener("click", () => {
    const raw = parseInt(document.getElementById("yearInput").value);
    const year = Number.isFinite(raw) ? raw : 2020;   // fallback

    drawScatterForYear(year);   
});

// ----------------------------------------
// Flags dict
// ----------------------------------------

const alpha3to2 = {
  ABW: "AW",
  AFG: "AF",
  AGO: "AO",
  ALB: "AL",
  AND: "AD",
  ARE: "AE",
  ARG: "AR",
  ARM: "AM",
  ASM: "AS",
  ATG: "AG",
  AUS: "AU",
  AUT: "AT",
  AZE: "AZ",
  BDI: "BI",
  BEL: "BE",
  BEN: "BJ",
  BFA: "BF",
  BGD: "BD",
  BGR: "BG",
  BHR: "BH",
  BHS: "BS",
  BIH: "BA",
  BLR: "BY",
  BLZ: "BZ",
  BMU: "BM",
  BOL: "BO",
  BRA: "BR",
  BRB: "BB",
  BRN: "BN",
  BTN: "BT",
  BWA: "BW",
  CAF: "CF",
  CAN: "CA",
  CHE: "CH",
  CHL: "CL",
  CHN: "CN",
  CIV: "CI",
  CMR: "CM",
  COD: "CD",
  COG: "CG",
  COL: "CO",
  COM: "KM",
  CPV: "CV",
  CRI: "CR",
  CUB: "CU",
  CUW: "CW",
  CYM: "KY",
  CYP: "CY",
  CZE: "CZ",
  DEU: "DE",
  DJI: "DJ",
  DMA: "DM",
  DNK: "DK",
  DOM: "DO",
  DZA: "DZ",
  ECU: "EC",
  EGY: "EG",
  ERI: "ER",
  ESP: "ES",
  EST: "EE",
  ETH: "ET",
  FIN: "FI",
  FJI: "FJ",
  FRA: "FR",
  FRO: "FO",
  FSM: "FM",
  GAB: "GA",
  GBR: "GB",
  GEO: "GE",
  GHA: "GH",
  GIB: "GI",
  GIN: "GN",
  GMB: "GM",
  GNB: "GW",
  GNQ: "GQ",
  GRC: "GR",
  GRD: "GD",
  GRL: "GL",
  GTM: "GT",
  GUM: "GU",
  GUY: "GY",
  HKG: "HK",
  HND: "HN",
  HRV: "HR",
  HTI: "HT",
  HUN: "HU",
  IDN: "ID",
  IMN: "IM",
  IND: "IN",
  IRL: "IE",
  IRN: "IR",
  IRQ: "IQ",
  ISL: "IS",
  ISR: "IL",
  ITA: "IT",
  JAM: "JM",
  JOR: "JO",
  JPN: "JP",
  KAZ: "KZ",
  KEN: "KE",
  KGZ: "KG",
  KHM: "KH",
  KIR: "KI",
  KNA: "KN",
  KOR: "KR",
  KWT: "KW",
  LAO: "LA",
  LBN: "LB",
  LBR: "LR",
  LBY: "LY",
  LCA: "LC",
  LIE: "LI",
  LKA: "LK",
  LSO: "LS",
  LTU: "LT",
  LUX: "LU",
  LVA: "LV",
  MAC: "MO",
  MAF: "MF",
  MAR: "MA",
  MCO: "MC",
  MDA: "MD",
  MDG: "MG",
  MDV: "MV",
  MEX: "MX",
  MHL: "MH",
  MKD: "MK",
  MLI: "ML",
  MLT: "MT",
  MMR: "MM",
  MNE: "ME",
  MNG: "MN",
  MNP: "MP",
  MOZ: "MZ",
  MRT: "MR",
  MUS: "MU",
  MWI: "MW",
  MYS: "MY",
  NAM: "NA",
  NCL: "NC",
  NER: "NE",
  NGA: "NG",
  NIC: "NI",
  NLD: "NL",
  NOR: "NO",
  NPL: "NP",
  NRU: "NR",
  NZL: "NZ",
  OMN: "OM",
  PAK: "PK",
  PAN: "PA",
  PER: "PE",
  PHL: "PH",
  PLW: "PW",
  PNG: "PG",
  POL: "PL",
  PRI: "PR",
  PRK: "KP",
  PRT: "PT",
  PRY: "PY",
  PSE: "PS",
  PYF: "PF",
  QAT: "QA",
  ROU: "RO",
  RUS: "RU",
  RWA: "RW",
  SAU: "SA",
  SDN: "SD",
  SEN: "SN",
  SGP: "SG",
  SLB: "SB",
  SLE: "SL",
  SLV: "SV",
  SMR: "SM",
  SOM: "SO",
  SRB: "RS",
  STP: "ST",
  SUR: "SR",
  SVK: "SK",
  SVN: "SI",
  SWE: "SE",
  SWZ: "SZ",
  SXM: "SX",
  SYC: "SC",
  SYR: "SY",
  TCA: "TC",
  TCD: "TD",
  TGO: "TG",
  THA: "TH",
  TJK: "TJ",
  TKM: "TM",
  TLS: "TL",
  TON: "TO",
  TTO: "TT",
  TUN: "TN",
  TUR: "TR",
  TUV: "TV",
  TZA: "TZ",
  UGA: "UG",
  UKR: "UA",
  URY: "UY",
  USA: "US",
  UZB: "UZ",
  VCT: "VC",
  VEN: "VE",
  VGB: "VG",
  VIR: "VI",
  VNM: "VN",
  VUT: "VU",
  WSM: "WS",
  XKX: "XK",
  YEM: "YE",
  ZAF: "ZA",
  ZMB: "ZM",
  ZWE: "ZW"
};

function flagURL(alpha3) {
    const a2 = alpha3to2[alpha3];
    if (!a2) return null;     // region → không có cờ
    return `data/flags/${a2.toLowerCase()}.png`;
}