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
    svg.append('text').attr('x',20).attr('y',30).text('Failed to load w``orld GeoJSON');
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
// LOAD DATA
// ----------------------------------------

Promise.all([
    loadWDIcsv("data/Economy/Economy_GDP (current US$).csv"),
    loadWDIcsv("data/Economy/Economy_GDP growth (annual _).csv"),
    loadWDIcsv("data/Agriculture/Agriculture and Rural development_Crop production index (2014-2016 = 100).csv"),
    loadWDIcsv("data/Agriculture/Agriculture and Rural development_Food production index (2014-2016 = 100).csv"),
    loadWDIcsv("data/Health/total_population.csv")
]).then(([gdpData, growthData, crop, food, totalPop]) => {
    ctx.gdpData = gdpData;
    ctx.growthData = growthData;
    ctx.crop = crop;
    ctx.food = food;
    ctx.totalPop = totalPop;

    drawScatterForYear(2020, "economy");   // ví dụ chọn năm 2020
    drawPopulationPacking(2020);

});

// ----------------------------------------
// DRAW POPULATION
// ----------------------------------------
function drawPopulationPacking(year) {
    const width = 800;
    const height = 800;

    // data processing
    data = ctx.totalPop
        .map(row => {
            const name = row["Country Name"];
            const code = row["Country Code"];
            const population = +row[year.toString()]; 

            return {
                name,
                code,
                population
            };
        })
        .filter(d => d.population > 0 && Number.isFinite(d.population) && flagURL(d.code));;


    const svg = d3.select("#populationSvg");
    svg.selectAll("*").remove();

    // Convert sang cấu trúc hierarchy mà d3.pack yêu cầu

    const rScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.population)])
        .range([10, 1000000]); // 5 là min radius

    const root = d3.pack()
        .size([width, height])
        .padding(3)
        (
        d3.hierarchy({ children: data })
          .sum(d => rScale(d.population))
        )
    ;

    const nodes = svg.selectAll("g.node")
        .data(root.leaves())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    // 1. Tạo clipPath cho mỗi node để ảnh cờ bị cắt theo hình tròn
    nodes.append("clipPath")
        .attr("id", d => `pop-clip-${d.data.code}`)
        .append("circle")
        .attr("r", d => d.r);

    // 2. Chèn ảnh cờ, sử dụng clip-path
    nodes.append("image")
        .attr("href", d => flagURL(d.data.code)) // hàm bạn đã có
        .attr("width", d => d.r * 2)
        .attr("height", d => d.r * 2)
        .attr("x", d => -d.r)
        .attr("y", d => -d.r)
        .attr("clip-path", d => `url(#pop-clip-${d.data.code})`)
        .attr("preserveAspectRatio", "xMidYMid slice");

    // Hình tròn
    nodes.append("circle")
        .attr("r", d => d.r)
        .attr("fill", "none")
        .attr("stroke", "gray")
        .attr("stroke-width", 1.5);;

    // Tooltip
    // nodes.append("title")
    //     .text(d => `${d.data.name}\nPopulation: ${d.data.population.toLocaleString()}`);

    nodes.on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .html(`<strong>${d.data.name}</strong><br>Population: ${d.data.population.toLocaleString()}`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));
}

// ----------------------------------------
// Linear regression
// ----------------------------------------

function linearRegression(data) {
    const n = data.length;
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    data.forEach(d => {
        sumX += d.xVal;
        sumY += d.yVal;
        sumXY += d.xVal * d.yVal;
        sumX2 += d.xVal * d.xVal;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

// ----------------------------------------
// DRAW Scatter
// ----------------------------------------

const scatterSvg = d3.select("#scatterSvg")
    .attr("width", 1400)
    .attr("height", 800);

const scatterG = scatterSvg.append("g").attr("class", "plot");
const xAxisG = scatterSvg.append("g").attr("class", "x-axis");
const yAxisG = scatterSvg.append("g").attr("class", "y-axis");
const titleG = scatterSvg.append("text").attr("class", "title");
const defs = scatterSvg.append("defs");

// linear regression settup
const regressionLine = scatterG
    .append("line")
    .attr("class", "regression-line")
    .attr("stroke", "crimson")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "6 4")
    .attr("opacity", 0);


function ensureClip(code, r = 8) {
    if (!defs.select(`#clip-${code}`).node()) {
        const cp = defs.append("clipPath")
            .attr("id", `clip-${code}`)
            .attr("clipPathUnits", "userSpaceOnUse");

        cp.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", r);
    }
}

function drawScatterForYear(year, section = "economy") {
    const yearStr = String(year);

    // Chọn dữ liệu theo section
    let dataX, dataY, labelX, labelY;
    if (section === "economy") {
        dataX = ctx.gdpData;
        dataY = ctx.growthData;
        labelX = "GDP (current US$)";
        labelY = "GDP growth (%)";
    } else if (section === "agriculture") {
        dataX = ctx.crop;
        dataY = ctx.food;
        labelX = "Crop production";
        labelY = "Food growth";
    } else {
        console.error("Unknown section:", section);
        return;
    }

    // Merge dữ liệu
    const merged = [];
    dataX.forEach(dX => {
        const code = dX["Country Code"];
        const dY = dataY.find(d => d["Country Code"] === code);
        if (!dY) return;

        const xVal = +dX[yearStr];
        const yVal = +dY[yearStr];
        if (xVal <= 0 || !Number.isFinite(yVal)) return;

        merged.push({
            name: dX["Country Name"],
            code,
            xVal,
            yVal
        });
    });

    const width = 1400;
    const height = 800;
    const margin = { top: 40, right: 40, bottom: 60, left: 80 };

    const x = d3.scaleLog()
        .domain(d3.extent(merged, d => d.xVal))
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(merged, d => d.yVal))
        .nice()
        .range([height - margin.bottom, margin.top]);

    const t = scatterSvg.transition().duration(750).ease(d3.easeCubicOut);

    // Axis transition
    xAxisG
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .transition(t)
        .call(d3.axisBottom(x).ticks(10, "~s"));
        

    yAxisG
        .attr("transform", `translate(${margin.left},0)`)
        .transition(t)
        .call(d3.axisLeft(y));

        // Label trục X
    xAxisG.selectAll(".axis-label").remove();
    xAxisG.append("text")
        .attr("class", "axis-label")
        .attr("x", (width - margin.left - margin.right)/2 + margin.left)
        .attr("y", 40) // cách trục X 50px
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .style("font-size", "16px")
        .text(labelX);

    // Label trục Y
    yAxisG.selectAll(".axis-label").remove();
    yAxisG.append("text")
        .attr("class", "axis-label")
        .attr("transform", `rotate(-90)`)
        .attr("x", -(height - margin.top - margin.bottom)/2 - margin.top)
        .attr("y", -40) // cách trục Y 60px sang trái
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .style("font-size", "16px")
        .text(labelY);


    // Title
    titleG
        .attr("x", width / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .transition(t)
        .text(`${labelX} vs ${labelY}, year ${year}`);

    // Points
    const mergedWithFlags = merged.filter(d => flagURL(d.code));

    const points = scatterG
        .selectAll("g.point")
        .data(mergedWithFlags, d => d.code);

    points.exit()
        .transition(t)
        .style("opacity", 0)
        .remove();

    const pointsEnter = points.enter()
        .append("g")
        .attr("class", "point")
        .attr("transform", d => `translate(${x(d.xVal)}, ${y(d.yVal)})`)
        .style("opacity", 0);

    const radius = 8;
    pointsEnter.each(d => ensureClip(d.code, radius));

    pointsEnter.append("image")
        .attr("href", d => flagURL(d.code) || "")
        .attr("x", -radius)
        .attr("y", -radius)
        .attr("width", radius * 2)
        .attr("height", radius * 2)
        .attr("clip-path", d => `url(#clip-${d.code})`)
        .attr("preserveAspectRatio", "xMidYMid slice");

    // Rebind the new data
    const allPoints = pointsEnter.merge(points);
    allPoints.select("image")
        .on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .html(`<strong>${d.name}</strong><br>${labelX}: ${d.xVal}<br>${labelY}: ${d.yVal}`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    pointsEnter.append("circle")
        .attr("r", radius)
        .attr("fill", "none")
        .attr("stroke", "gray")
        .style("pointer-events", "none");

    pointsEnter.merge(points)
        .transition(t)
        .style("opacity", 1)
        .attr("transform", d => `translate(${x(d.xVal)}, ${y(d.yVal)})`);

    // ---------------------------
    // LINEAR REGRESSION
    // const lr = linearRegression(mergedWithFlags);
    const lr = linearRegression(
        mergedWithFlags.map(d => ({
            xVal: Math.log10(d.xVal),  // hoặc Math.log
            yVal: d.yVal
        }))
    );


    if (lr) {
        const xDomain = x.domain(); // [xmin, xmax]

        const regressionData = [
            {
                xVal: xDomain[0],
                yVal: lr.slope * Math.log10(xDomain[0]) + lr.intercept
                // yVal: lr.slope * xDomain[0] + lr.intercept
            },
            {
                xVal: xDomain[1],
                yVal: lr.slope * Math.log10(xDomain[1]) + lr.intercept
                // yVal: lr.slope * xDomain[1] + lr.intercept
            }
        ];

        regressionLine
            .transition(t)
            .attr("opacity", 1)
            .attr("x1", x(regressionData[0].xVal))
            .attr("y1", y(regressionData[0].yVal))
            .attr("x2", x(regressionData[1].xVal))
            .attr("y2", y(regressionData[1].yVal));
    } else {
        regressionLine
            .transition(t)
            .attr("opacity", 0);
    }
}

// ----------------------------------------
// Update button for population plot
// ----------------------------------------


document.getElementById("updateBtn-population").addEventListener("click", () => {
    const raw = parseInt(document.getElementById("yearInput-population").value);
    const year = Number.isFinite(raw) ? raw : 2020;   // fallback
    drawPopulationPacking(year);
});

// ----------------------------------------
// Update button for scatter plot
// ----------------------------------------


document.getElementById("updateBtn-scatter").addEventListener("click", () => {
    const raw = parseInt(document.getElementById("yearInput-scatter").value);
    const year = Number.isFinite(raw) ? raw : 2020;   // fallback
    const sector = document.getElementById("sectorSelect").value;

    if (sector === "economy") {
        console.log("Drawing scatter economy for year:", year);
        drawScatterForYear(year, "economy");
    } else {
        console.log("Drawing scatter agriculture for year:", year);
        drawScatterForYear(year, "agriculture");
    }
});

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
};