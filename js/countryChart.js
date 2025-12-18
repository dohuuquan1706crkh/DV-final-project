const AGE_GROUPS = [
  "00-04","05-09","10-14","15-19","20-24","25-29","30-34",
  "35-39","40-44","45-49","50-54","55-59","60-64","65-69",
  "70-74","75-79","80+"
];
let allCountries = [];
let primaryCountry = null;
let compareCountry = null;
let economyMode = "gdp";
let prodMode = "crop";
let lastComparedCountry = null;
let economyChart = {
  svg: null,
  x: null,
  y: null,
  line: null,
  pathA: null,
  pathB: null,
  yAxisG: null
};
const radarUpdaters = {};

const ctx = {};
let pieCharts = []; // store references to each pie
async function showCharts(countryName) {
  await loadKPIs(countryName);
  await drawPopulationPyramid(countryName);
  await drawGDPChart(countryName);
  await drawAgricultureChart(countryName);
  
  let emissionType = "CO2";
  drawEmissionChart(countryName, emissionType);
  document.getElementById("emissionType")
  .addEventListener("change", function () {
    emissionType = this.value;
    drawEmissionChart(countryName, emissionType);
  });

  await initEmissionPieCharts(countryName);

  const slider = document.getElementById("yearSlider");
  const label = document.getElementById("yearLabel");

  // first draw
  updateEmissionPieCharts(countryName, slider.value);

  slider.addEventListener("input", () => {
    label.textContent = slider.value;
    updateEmissionPieCharts(countryName, slider.value);
  });

  loadCountryList();
}
function updateAllComparisons(country1, country2, economyMode, prodMode) {
  compareEconomy(country1, country2, economyMode);
  compareProduction(country1, country2, prodMode);
}




document.getElementById("compareBtn").addEventListener("click", () => {
  const secondCountry = document.getElementById("compareSearch").value.trim();
  if (!secondCountry) return alert("Please select a country");

  lastComparedCountry = secondCountry;
  updateAllComparisons(countryName, secondCountry, economyMode, prodMode);
  // compareEconomy(countryName, secondCountry, economyMode);

  drawEmissionRadar(countryName, secondCountry, "co2");
  drawEmissionRadar(countryName, secondCountry, "n2o");
  drawEmissionRadar(countryName, secondCountry, "ch4");
});

document.getElementById("toggleEconomyBtn").addEventListener("click", function () {
  if (!lastComparedCountry) return;

  economyMode = economyMode === "gdp" ? "growth" : "gdp";
  this.textContent =
    economyMode === "gdp" ? "Switch to GDP Growth" : "Switch to GDP";

  compareEconomy(countryName, lastComparedCountry, economyMode);
});

document.getElementById("toggleProdBtn").addEventListener("click", function () {
  if (!lastComparedCountry) return;

  prodMode = prodMode === "crop" ? "food" : "crop";
  this.textContent =
    prodMode === "crop" ? "Switch to Food Production" : "Switch to Crop Production";

  compareProduction(countryName, lastComparedCountry, prodMode);
});

async function loadKPIs(countryName) {
  const YEAR = "2024";

  /* ======================
     Population (total)
  ====================== */
  const popCSV = await d3.csv(
    "Dataset/Health/total_population.csv"
  );
  const popRow = popCSV.find(d => d["Country Name"] === countryName);
  const population = popRow && popRow[YEAR]
    ? +popRow[YEAR]
    : null;

  /* ======================
     GDP & GDP growth
  ====================== */
  const gdpCSV = await d3.csv(
    "Dataset/Economy/Economy_GDP(current US$).csv"
  );
  const growthCSV = await d3.csv(
    "Dataset/Economy/Economy_GDP growth (annual _).csv"
  );

  const gdpRow = gdpCSV.find(d => d["Country Name"] === countryName);
  const growthRow = growthCSV.find(d => d["Country Name"] === countryName);

  const gdp = gdpRow && gdpRow[YEAR] ? +gdpRow[YEAR] : null;
  const gdpGrowth = growthRow && growthRow[YEAR]
    ? +growthRow[YEAR]
    : null;

/* ======================
   Food Production Index
====================== */
  const foodCSV = await d3.csv(
    "Dataset/Agriculture/Agriculture and Rural development_Food production index (2014-2016 = 100).csv"
  );

  const foodRow = foodCSV.find(d => d["Country Name"] === countryName);

  const foodIndex = foodRow && foodRow[YEAR-2]
    ? +foodRow[YEAR-2]
    : null;
  console.log("foodIndex");
  console.log(foodRow);

  /* ======================
     Render KPIs
  ====================== */
  document.getElementById("kpi-population").textContent =
    population
      ? d3.format(",")(population)
      : "N/A";

  document.getElementById("kpi-gdp").textContent =
    gdp
      ? `$${d3.format(".2s")(gdp)}`
      : "N/A";

  document.getElementById("kpi-gdp-growth").textContent =
    gdpGrowth !== null
      ? `${gdpGrowth.toFixed(2)}%`
      : "N/A";

document.getElementById("kpi-food").textContent =
  foodIndex !== null ? d3.format(".1f")(foodIndex) : "N/A";
}

async function drawPopulationPyramid(countryName) {
  const pyramidDiv = d3.select("#pyramidChart");
  pyramidDiv.selectAll("*").remove(); // Clear existing chart

  try {
    const rawData = await Promise.all(
      AGE_GROUPS.map(async ageGroup => {
        const [maleData, femaleData] = await Promise.all([
          d3.csv(`DataSet/Health/Health_Population_ages_${ageGroup === "80+" ? "80_and_above" : ageGroup}_male_of_male_population.csv`),
          d3.csv(`DataSet/Health/Health_Population_ages_${ageGroup === "80+" ? "80_and_above" : ageGroup}_female_of_female_population.csv`)
        ]);

        const combinedData = maleData.map((row, i) => {
          const femaleRow = femaleData[i];
          const combinedRow = { ...row };
          Object.keys(row).forEach(key => {
            if (!isNaN(+row[key]) && !isNaN(+femaleRow[key])) {
              combinedRow[key] = (parseFloat(row[key]) + parseFloat(femaleRow[key])) / 2;
            }
          });
          return combinedRow;
        });

        return {
          ageGroup,
          male: maleData,
          female: femaleData,
          total: combinedData
        };
      })
    );

    const totalData = rawData.map(group => ({
      ageGroup: group.ageGroup,
      data: group.total
    }));


    ctx.heatData = transformDataForHeatmap(totalData, countryName);
    createHeatMap(ctx.heatData);

    ctx.genderData = rawData.map(group => ({
      ageGroup: group.ageGroup,
      male: group.male,
      female: group.female
    }));

    const pyramidData = transformDataForPyramid(ctx.genderData, countryName, 2020);
    initPyramidChart();
    updatePyramidData(pyramidData);

  } catch (err) {
    console.error("Error loading population data:", err);
    pyramidDiv.append("p").text("Failed to load population data.");
  }
}

// ----------------------------
// Heat chart
// ----------------------------

function transformDataForHeatmap(file, countryName) {
    let pyramidData = []; 
    file.forEach(function(index) {
        // Find the country row within this dataset
        const result = file.map(group => {

            const dataOverYear = group.data.find(d => d["Country Name"] === countryName);
            if (dataOverYear) {
                return { dataOverYear, ageGroup: group.ageGroup };
            }
            return null; 
        })
        .filter(item => item !== null); 
        pyramidData.push(result);
    });
    return pyramidData[0];  // Return the transformed data
}

function createHeatMap(countryData) {
    const data = [];
    countryData.forEach(d => {
        const age = d.ageGroup;
        for (const year in d.dataOverYear) {
            if (year !== "" && d.dataOverYear[year] !== "") {
                data.push({
                    year: +year,
                    ageGroup: age,
                    value: +d.dataOverYear[year]
                });
            }
        }
    });

    const margin = { top: 50, right: 110, bottom: 50, left: 80 },
          width = 860 - margin.left - margin.right,
          height = 400 - margin.top - margin.bottom;

    const legendWidth = 20;
    const legendHeight = 200;

    // Tạo SVG
    const svg = d3.select("#pyramidHeatmap")
                  .append("svg")
                  .attr("width", width + margin.left + margin.right)
                  .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                  .attr("transform", `translate(${margin.left},${margin.top})`);

    // Lấy danh sách năm và nhóm tuổi
    const years = Array.from(new Set(data.map(d => d.year))).sort((a,b) => a-b);
    const ageGroups = Array.from(new Set(data.map(d => d.ageGroup))).reverse();

    // Scale trục hoành (năm)
    const x = d3.scaleBand()
                .domain(years)
                .range([0, width])
                .padding(0.05);

    // Scale trục tung (ageGroup)
    const y = d3.scaleBand()
                .domain(ageGroups)
                .range([0, height])
                .padding(0.05);

    // Scale màu theo population
    const color = d3.scaleSequential()
                    .interpolator(d3.interpolateYlOrRd)
                    .domain(d3.extent(data, d => d.value));

    // Thêm trục
    svg.append("g")
       .attr("transform", `translate(0, ${height})`)
       .call(d3.axisBottom(x).tickValues(x.domain().filter((d,i) => !(i%5)))); // mỗi 5 năm
       
    svg.append("g")
       .call(d3.axisLeft(y));

    // Vẽ các ô heatmap
    svg.selectAll()
       .data(data)
       .enter()
       .append("rect")
       .attr("x", d => x(d.year))
       .attr("y", d => y(d.ageGroup))
       .attr("width", x.bandwidth())
       .attr("height", y.bandwidth())
       .style("fill", d => color(d.value))
       .append("title") // tooltip
       .text(d => `${d.ageGroup} (${d.year}): ${d.value}`);

    // legend
    const legendGroup = svg.append("g")
    .attr("transform", `translate(${width + 40}, ${(height - legendHeight) / 2})`);
    const defs = svg.append("defs");

    const linearGradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    linearGradient.selectAll("stop")
        .data(d3.ticks(0, 1, 10))
        .enter()
        .append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d =>
            color(
                d3.interpolate(
                    color.domain()[0],
                    color.domain()[1]
                )(d)
            )
        );

    legendGroup.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");

    const legendScale = d3.scaleLinear()
    .domain(color.domain())
    .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
        .ticks(6);

    legendGroup.append("g")
        .attr("transform", `translate(${legendWidth}, 0)`)
        .call(legendAxis);

    legendGroup.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text("Population (%)");
}

// ----------------------------
// Pyramid chart
// ----------------------------

function transformDataForPyramid(file, countryName, year) {
    return file
        .map(group => {
            const maleRow = group.male.find(
                d => d["Country Name"] === countryName
            );
            const femaleRow = group.female.find(
                d => d["Country Name"] === countryName
            );

            if (!maleRow || !femaleRow) return null;

            return {
                ageGroup: group.ageGroup,
                male: +maleRow[year],     // 🔥 lọc theo năm
                female: +femaleRow[year]  // 🔥 lọc theo năm
            };
        })
        .filter(d => d !== null);
}

let pyramidSvg, xScale, yScale, width, height;

function initPyramidChart() {
  const container = d3.select("#pyramidChart");
  container.selectAll("*").remove();

  const margin = { top: 50, right: 30, bottom: 75, left: 40 };
  width = 420 - margin.left - margin.right;
  height = 400 - margin.top - margin.bottom;

  pyramidSvg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  xScale = d3.scaleLinear().range([0, width]);
  yScale = d3.scaleBand().range([height, 0]).padding(0.1);

  pyramidSvg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`);

  pyramidSvg.append("g")
    .attr("class", "y-axis");

  // center line
  // pyramidSvg.append("line")
  //   .attr("class", "center-line")
  //   .attr("y1", 0)
  //   .attr("y2", height)
  //   .attr("stroke", "#000");

  // labels
  pyramidSvg.append("text")
    .attr("class", "label male")
    .attr("x", width * 0.25)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .text("Male");

  pyramidSvg.append("text")
    .attr("class", "label female")
    .attr("x", width * 0.75)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .text("Female");
  // ---- LEGEND (CREATE ONCE) ----
// const legend = wrapper.append("div")
//   .style("margin-top", "6px")
//   .style("font-size", "12px")
//   .style("display", "flex")
//   .style("justify-content", "center")
//   .style("gap", "12px");

// const legendItem = legend.selectAll(".legend-item")
//   .data(PIE_CATEGORIES)
//   .enter()
//   .append("div")
//   .style("display", "flex")
//   .style("align-items", "center")
//   .style("gap", "4px");

// legendItem.append("span")
//   .style("width", "12px")
//   .style("height", "12px")
//   .style("display", "inline-block")
//   .style("background-color", d => color(d));

// legendItem.append("span")
//   .text(d => d);

}

function updatePyramidData(pyramidData) {

  const data = pyramidData.map(d => ({
    ageGroup: d.ageGroup,
    male: -d.male,
    female: d.female
  }));

  const maxValue = d3.max(pyramidData, d => Math.max(d.male, d.female));

  xScale.domain([-maxValue, maxValue]);
  yScale.domain(data.map(d => d.ageGroup));

  // ===== AXIS TRANSITION =====
  pyramidSvg.select(".x-axis")
    .transition()
    .duration(800)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => Math.abs(d)));

  pyramidSvg.select(".y-axis")
    .transition()
    .duration(800)
    .call(d3.axisLeft(yScale));

  pyramidSvg.select(".center-line")
    .transition()
    .duration(800)
    .attr("x1", xScale(0))
    .attr("x2", xScale(0));

  // ===== MALE =====
  pyramidSvg.selectAll(".bar.male")
    .data(data, d => d.ageGroup)
    .join(
      enter => enter.append("rect")
        .attr("class", "bar male")
        .attr("y", d => yScale(d.ageGroup))
        .attr("height", yScale.bandwidth())
        .attr("x", xScale(0))
        .attr("width", 0)
        .attr("fill", "#4e79a7")
        .call(enter => enter.transition().duration(800)
          .attr("x", d => xScale(d.male))
          .attr("width", d => xScale(0) - xScale(d.male))
        ),

      update => update.transition().duration(800)
        .attr("y", d => yScale(d.ageGroup))
        .attr("x", d => xScale(d.male))
        .attr("width", d => xScale(0) - xScale(d.male))
        .attr("height", yScale.bandwidth())
    );

  // ===== FEMALE =====
  pyramidSvg.selectAll(".bar.female")
    .data(data, d => d.ageGroup)
    .join(
      enter => enter.append("rect")
        .attr("class", "bar female")
        .attr("y", d => yScale(d.ageGroup))
        .attr("height", yScale.bandwidth())
        .attr("x", xScale(0))
        .attr("width", 0)
        .attr("fill", "#e15759")
        .call(enter => enter.transition().duration(800)
          .attr("width", d => xScale(d.female) - xScale(0))
        ),

      update => update.transition().duration(800)
        .attr("y", d => yScale(d.ageGroup))
        .attr("x", xScale(0))
        .attr("width", d => xScale(d.female) - xScale(0))
        .attr("height", yScale.bandwidth())
    );

}

document.getElementById("updateBtn-pyramid").addEventListener("click", () => {
  const yearInput = document.getElementById("yearInput-pyramid");
  const raw = parseInt(document.getElementById("yearInput-pyramid").value);
  const year = (Number.isFinite(raw) && raw >= 1960 && raw <= 2024) ? raw : 2020;

  if (year !== raw) {
    yearInput.value = year; // cập nhật input về giá trị mặc định
  }

  const pyramidData = transformDataForPyramid(ctx.genderData, countryName, year);
  updatePyramidData(pyramidData);
});


// ----------------------------
// GDP chart
// ----------------------------
async function drawGDPChart(countryName) {
  const gdpDiv = d3.select("#gdpChart");
  gdpDiv.selectAll("*").remove();

  try {
    const gdpCSV = await d3.csv("Dataset/Economy/Economy_GDP(current US$).csv");
    const growthCSV = await d3.csv("Dataset/Economy/Economy_GDP growth (annual _).csv");

    const gdpRow = gdpCSV.find(d => d["Country Name"] === countryName);
    const growthRow = growthCSV.find(d => d["Country Name"] === countryName);

    if (!gdpRow || !growthRow) {
      gdpDiv.append("p").text("No GDP data available.");
      return;
    }

    // ---------- Parse data ----------
    const gdp = Object.entries(gdpRow)
      .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
      .map(([y, v]) => ({ year: +y, value: +v }))
      .sort((a, b) => a.year - b.year);

    const growth = Object.entries(growthRow)
      .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
      .map(([y, v]) => ({ year: +y, value: +v }))
      .filter(d => !isNaN(d.value))
      .sort((a, b) => a.year - b.year);

    // ---------- Layout ----------
    const margin = { top: 40, right: 280, bottom: 40, left: 80 };
    const width = 1200 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = gdpDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const chart = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // ---------- Scales ----------
    const x = d3.scaleLinear()
      .domain(d3.extent(gdp, d => d.year))
      .range([0, width]);

    const yGDP = d3.scaleLinear()
      .domain([0, d3.max(gdp, d => d.value)])
      .nice()
      .range([height, 0]);

    const yGrowth = d3.scaleLinear()
      .domain([
        Math.min(0, d3.min(growth, d => d.value)),
        Math.max(0, d3.max(growth, d => d.value))
      ])
      .nice()
      .range([height, 0]);

    // ---------- Horizon baseline ----------
    const zeroY = yGrowth(0);

    chart.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", zeroY)
      .attr("y2", zeroY)
      .attr("stroke", "#adb5bd");

    function drawHorizonBand(data, color, positive) {
      const area = d3.area()
        .x(d => x(d.year))
        .y0(zeroY)
        .y1(d =>
          positive
            ? yGrowth(Math.max(0, d.value))
            : yGrowth(Math.min(0, d.value))
        )
        .curve(d3.curveMonotoneX);

      chart.append("path")
        .datum(data)
        .attr("fill", color)
        .attr("opacity", 0.85)
        .attr("d", area);
    }

    // Horizon bands
    drawHorizonBand(growth, "#b1e6ffff", true);
    drawHorizonBand(growth, "#f37171ff", false);

    // ---------- Axes ----------
    chart.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    chart.append("g")
      .call(d3.axisLeft(yGDP).ticks(6).tickFormat(d3.format(".2s")));

    chart.append("g")
      .attr("transform", `translate(${width},0)`)
      .call(d3.axisRight(yGrowth).ticks(6));

    // ---------- GDP line ----------
    const gdpLinePath = chart.append("path")
      .datum(gdp)
      .attr("fill", "none")
      .attr("stroke", "#4c78a8")
      .attr("stroke-width", 2.5)
      .attr("d", d3.line()
        .x(d => x(d.year))
        .y(d => yGDP(d.value))
        .curve(d3.curveMonotoneX)
      );

    const totalLength = gdpLinePath.node().getTotalLength();

    gdpLinePath
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    // ---------- Axis labels ----------
    chart.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .text("Year");

    chart.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .text("GDP (current US$)");

    chart.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", width + 65)
      .attr("text-anchor", "middle")
      .text("GDP Growth (Horizon)");

    // ---------- Legend (right, outside plot) ----------
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${margin.left + width + 110}, ${margin.top + 100})`
      );

    const legendData = [
      { label: "GDP (current US$)", color: "#4c78a8", type: "line" },
      { label: "GDP Growth (Positive)", color: "#b1e6ffff", type: "rect" },
      { label: "GDP Growth (Negative)", color: "#f37171ff", type: "rect" }
    ];

    const legendItem = legend.selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 24})`);

    legendItem.filter(d => d.type === "line")
      .append("line")
      .attr("x1", 0)
      .attr("x2", 25)
      .attr("y1", 8)
      .attr("y2", 8)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 3);

    legendItem.filter(d => d.type === "rect")
      .append("rect")
      .attr("x", 0)
      .attr("y", 2)
      .attr("width", 25)
      .attr("height", 12)
      .attr("fill", d => d.color)
      .attr("opacity", 0.85);

    legendItem.append("text")
      .attr("x", 35)
      .attr("y", 12)
      .style("font-size", "12px")
      .text(d => d.label);

  } catch (err) {
    console.error(err);
    gdpDiv.append("p").text("Failed to load GDP data.");
  }
}

// ----------------------------
// Agriculture chart
// ----------------------------
function exponentialRegression(data) {
  // data: [{year, value}]
  const n = data.length;
  if (n < 2) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  data.forEach(d => {
    const x = d.year;
    const y = Math.log(d.value); // ln(y)
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const lnA = (sumY - b * sumX) / n;
  const a = Math.exp(lnA);

  return { a, b };
}

async function drawAgricultureChart(countryName){
  const agriDiv = d3.select("#agricultureChart");
  agriDiv.selectAll("*").remove();
  try {
    const cropProductionData = await d3.csv(
      "Dataset/Agriculture/Agriculture and Rural development_Crop production index (2014-2016 = 100).csv"
    );
    const foodProductionData = await d3.csv(
      "Dataset/Agriculture/Agriculture and Rural development_Food production index (2014-2016 = 100).csv"
    );
    const countryCropData = cropProductionData.find(
      d => d["Country Name"] === countryName
    );
    const countryFoodData = foodProductionData.find(
      d => d["Country Name"] === countryName
    );
    if (!countryCropData && !countryFoodData) {
      agriDiv.append("p").text("No agriculture data found for this country.");
      return;
    }
    // Crop production values
    const cropValues = Object.entries(countryCropData || {})
      .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
      .map(([year, val]) => ({ year: +year, value: +val }))
      .filter(d => !isNaN(d.value))
      .sort((a, b) => a.year - b.year);
    // Food production values
    const foodValues = Object.entries(countryFoodData || {})
      .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
      .map(([year, val]) => ({ year: +year, value: +val }))
      .filter(d => !isNaN(d.value))
      .sort((a, b) => a.year - b.year);
    // Merge crop & food by year
    const mergedData = cropValues.map(d => {
      const food = foodValues.find(f => f.year === d.year);
      return food
        ? { year: d.year, crop: d.value, food: food.value }
        : null;
    }).filter(d => d !== null);
    // init svg
    const margin = {top: 20, right: 200, bottom: 40, left: 150};
    const width = 1000 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    const svg = agriDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    // X scale (Year)
    const x = d3.scaleLinear()
      .domain(d3.extent(cropValues, d => d.year))
      .range([0, width]);
    // Y scale – Crop production (left)
    const yCrop = d3.scaleLinear()
      .domain([0, d3.max(cropValues, d => d.value)])
      .nice()
      .range([height, 0]);
    // Y scale – Food production (right)
    const yFood = d3.scaleLinear()
      .domain([
        d3.min(foodValues, d => d.value),
        d3.max(foodValues, d => d.value)
      ])
      .nice()
      .range([height, 0]);
    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g")
      .call(d3.axisLeft(yCrop).ticks(6));
    svg.append("g")
      .attr("transform", `translate(${width},0)`)
      .call(d3.axisRight(yFood).ticks(6));
    // Line generators
    const lineCrop = d3.line()
      .x(d => x(d.year))
      .y(d => yCrop(d.value))
      .curve(d3.curveMonotoneX);
    const lineFood = d3.line()
      .x(d => x(d.year))
      .y(d => yFood(d.value))
      .curve(d3.curveMonotoneX);
    // Draw lines
    svg.append("path")
      .datum(cropValues)
      .attr("fill", "none")
      .attr("stroke", "#5A9CB5")
      .attr("stroke-width", 2.5)
      .attr("d", lineCrop);
    svg.append("path")
      .datum(foodValues)
      .attr("fill", "none")
      .attr("stroke", "#FA6868")
      .attr("stroke-width", 2.5)
      .attr("d", lineFood);
    // Draw dots
    svg.selectAll(".dotCrop")
      .data(cropValues)
      .enter().append("circle")
      .attr("class", "dotCrop")
      .attr("cx", d => x(d.year))
      .attr("cy", d => yCrop(d.value))
      .attr("r", 3)
      .attr("fill", "#5A9CB5");
    svg.selectAll(".dotFood")
      .data(foodValues)
      .enter().append("circle")
      .attr("class", "dotFood")
      .attr("cx", d => x(d.year))
      .attr("cy", d => yFood(d.value))
      .attr("r", 3)
      .attr("fill", "#FA6868");
    // Labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .text("Year");
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .text("Crop Production Index (2014–2016 = 100)");
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", width + 60)
      .attr("text-anchor", "middle")
      .text("Food Production Index (2014–2016 = 100)");
    // Exponential regression
    const cropReg = exponentialRegression(cropValues);
    const foodReg = exponentialRegression(foodValues);
    // Years range
    const years = d3.range(
      d3.min(cropValues, d => d.year),
      d3.max(cropValues, d => d.year) + 1
    );
    // Regression curves
    const cropRegCurve = cropReg
      ? years.map(y => ({
          year: y,
          value: cropReg.a * Math.exp(cropReg.b * y)
        }))
      : [];
    const foodRegCurve = foodReg
      ? years.map(y => ({
          year: y,
          value: foodReg.a * Math.exp(foodReg.b * y)
        }))
      : [];
    const lineCropReg = d3.line()
      .x(d => x(d.year))
      .y(d => yCrop(d.value))
      .curve(d3.curveMonotoneX);
    const lineFoodReg = d3.line()
      .x(d => x(d.year))
      .y(d => yFood(d.value))
      .curve(d3.curveMonotoneX);
    // Crop exponential regression
    svg.append("path")
      .datum(cropRegCurve)
      .attr("fill", "none")
      .attr("stroke", "#5A9CB5")
      .attr("stroke-opacity", 0.8)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,4")
      .attr("d", lineCropReg);
    // Food exponential regression
    svg.append("path")
      .datum(foodRegCurve)
      .attr("fill", "none")
      .attr("stroke", "#FA6868")
      .attr("stroke-opacity", 0.8)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,4")
      .attr("d", lineFoodReg);
    // ===== Legend =====
    const legendData = [
      { label: "Crop production", color: "#5A9CB5", dash: "0" },
      { label: "Food production", color: "#FA6868", dash: "0" },
      { label: "Crop exponential trend", color: "#5A9CB5", dash: "6,4" },
      { label: "Food exponential trend", color: "#FA6868", dash: "6,4" }
    ];
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${60}, 10)`);
    const legendItem = legend.selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);
    // Line symbol
    legendItem.append("line")
      .attr("x1", -40)
      .attr("x2", -10)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", d => d.dash);
    // Text
    legendItem.append("text")
      .attr("x", -5)
      .attr("y", 4)
      .style("font-size", "12px")
      .text(d => d.label);
    legend.insert("rect", ":first-child")
      .attr("x", -45)
      .attr("y", -12)
      .attr("width", 180)
      .attr("height", legendData.length * 20 + 10)
      .attr("fill", "#eee")
      .attr("opacity", 0.4)
      .attr("rx", 4);

    // ===== Agriculture KPIs (right side) =====
    const latestCrop = cropValues[cropValues.length - 1];
    const latestFood = foodValues[foodValues.length - 1];

    const prevCrop = cropValues[cropValues.length - 2];
    const prevFood = foodValues[foodValues.length - 2];

    // 1. Food production index
    document.getElementById("kpi-food-agri").textContent =
      latestFood ? latestFood.value.toFixed(1) : "N/A";

    // 2. Crop production index
    document.getElementById("kpi-crop").textContent =
      latestCrop ? latestCrop.value.toFixed(1) : "N/A";

    // 3. Agriculture growth (% – food index YoY)
    document.getElementById("kpi-agri-growth").textContent =
      latestFood && prevFood
        ? (((latestFood.value - prevFood.value) / prevFood.value) * 100).toFixed(2) + "%"
        : "N/A";

    // 4. Gap between food & crop indices
    document.getElementById("kpi-agri-gap").textContent =
      latestFood && latestCrop
        ? (latestFood.value - latestCrop.value).toFixed(1)
        : "N/A";

  } catch (err) {
    console.error("Error loading agriculture data:", err);
    agriDiv.append("p").text("Failed to load agriculture data.");
  }
}

// ----------------------------
// emission chart
// ----------------------------

let emissionSvg, emissionX, emissionY, emissionLineGenerator, emissionSeriesPaths;

async function drawEmissionChart(countryName, emissionType) {
  const emissionDiv = d3.select("#emissionChart");

  // Load data
  const files = [
    `Dataset/Environment/Urban developement (${emissionType}) emissions from Industrial Combustion (Energy) (Mt CO2e).csv`,
    `Dataset/Environment/Urban developement (${emissionType}) emissions from Transport (Energy) (Mt CO2e).csv`,
    `Dataset/Environment/Urban developement (${emissionType}) emissions from Power Industry (Energy) (Mt CO2e).csv`,
    `Dataset/Environment/Urban developement (${emissionType}) emissions from Building (Energy) (Mt CO2e).csv`
  ];

  const seriesNames = [
    "Industrial Combustion",
    "Transport",
    "Power Industry",
    "Building"
  ];

  const colors = ["#4C6A92", "#8C6D5C", "#1f77b4", "#7A8F7A"];

  const datasets = await Promise.all(files.map(f => d3.csv(f)));

  const dataByYear = {};

  datasets.forEach((dataset, i) => {
    const row = dataset.find(d => d["Country Name"] === countryName);
    if (!row) return;

    Object.entries(row)
      .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
      .forEach(([year, value]) => {
        if (!dataByYear[year]) dataByYear[year] = { year: +year };
        dataByYear[year][seriesNames[i]] = +value;
      });
  });

  const data = Object.values(dataByYear).sort((a,b) => a.year - b.year);
  if (!data.length) {
    emissionDiv.append("p").text("No emission data found.");
    return;
  }

  // CHART SETUP
  const margin = { top: 20, right: 120, bottom: 40, left: 60 };
  const width = 1200 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // If SVG exists, reuse it
  if (!emissionSvg) {
    emissionSvg = emissionDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    emissionX = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([0, width]);

    emissionY = d3.scaleLinear()
      .domain([0, d3.max(data, d => Math.max(...seriesNames.map(s => d[s] || 0)))])
      .nice()
      .range([height, 0]);

    emissionSvg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(emissionX).tickFormat(d3.format("d")));

    emissionSvg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(emissionY));

    emissionSvg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .text("Year");

    emissionSvg.append("text")
      .attr("class", "y-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .text(`${emissionType} Emissions (Mt CO2e)`);

    // Line generator
    emissionLineGenerator = d3.line()
      .x(d => emissionX(d.year))
      .y(d => emissionY(d.value))
      .curve(d3.curveMonotoneX);

    // Initialize paths
    emissionSeriesPaths = emissionSvg.selectAll(".emission-line")
      .data(seriesNames.map(s => ({ name: s, color: colors[seriesNames.indexOf(s)], values: data.map(d => ({ year: d.year, value: d[s] || 0 })) })))
      .enter()
      .append("path")
      .attr("class", "emission-line")
      .attr("fill", "none")
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2.5)
      .attr("d", d => emissionLineGenerator(d.values));
      /* ======================
        LEGEND
      ====================== */
      const legend = emissionSvg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width + 20}, 20)`); // position to the right of chart

      seriesNames.forEach((name, i) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(0, ${i * 25})`);

        // color box
        legendRow.append("rect")
          .attr("width", 18)
          .attr("height", 18)
          .attr("fill", colors[i]);

        // text
        legendRow.append("text")
          .attr("x", 24)
          .attr("y", 14)
          .text(name)
          .style("font-size", "12px");
});

  } else {
    // UPDATE SCALE
    emissionY.domain([0, d3.max(data, d => Math.max(...seriesNames.map(s => d[s] || 0)))])
      .nice();

    emissionSvg.select(".y-axis")
      .transition().duration(800)
      .call(d3.axisLeft(emissionY));

    // Update Y label
    emissionSvg.select(".y-label")
      .text(`${emissionType} Emissions (Mt CO2e)`);

    // UPDATE LINES
    emissionSeriesPaths.data(seriesNames.map(s => ({ name: s, color: colors[seriesNames.indexOf(s)], values: data.map(d => ({ year: d.year, value: d[s] || 0 })) })))
      .transition()
      .duration(800)
      .attr("d", d => emissionLineGenerator(d.values));
  }
}

// ----------------------------
// emission pie chart
// ----------------------------

async function initEmissionPieCharts(countryName) {
  const container = d3.select("#emissionPieChart");

  const pollutants = [
    "Industrial Combustion",
    "Transport",
    "Power Industry",
    "Building"
  ];

  const PIE_CATEGORIES = ["CO2", "N2O", "CH4"];
  const PIE_COLORS = ["#4C6A92", "#7A8F7A", "#9FA6B2"];

  const width = 220;
  const height = 220;
  const radius = Math.min(width, height) / 2 - 20;

  const color = d3.scaleOrdinal()
    .domain(PIE_CATEGORIES)
    .range(PIE_COLORS);

  const pie = d3.pie()
    .value(d => d.value)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  for (let i = 0; i < pollutants.length; i++) {
    const wrapper = container.append("div")
      .style("flex", "1 1 45%")
      .style("display", "flex")       // make wrapper flex row
      .style("align-items", "center")  // vertically center
      .style("gap", "12px");           // space between chart and legend

    // Pie + title container
    const pieContainer = wrapper.append("div")
      .style("text-align", "center")

    pieContainer.append("div")
      .attr("class", "pie-title")
      .style("font-weight", "600")
      .style("margin-bottom", "6px")
      .text(pollutants[i]);

    const svg = pieContainer.append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);


    const legend = wrapper.append("div")
      .style("display", "flex")
      .style("flex-direction", "column") // stack legend items vertically
      .style("font-size", "12px")
      .style("gap", "6px");               // space between items

    const legendItem = legend.selectAll(".legend-item")
      .data(PIE_CATEGORIES)
      .enter()
      .append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "4px");

    legendItem.append("span")
      .style("width", "12px")
      .style("height", "12px")
      .style("display", "inline-block")
      .style("background-color", d => color(d));

    legendItem.append("span")
      .text(d => d);


    // create EMPTY arcs (important!)
    const paths = svg.selectAll("path")
      .data(pie(PIE_CATEGORIES.map(c => ({ category: c, value: 0 }))))
      .enter()
      .append("path")
      .attr("fill", d => color(d.data.category))
      .attr("stroke", "#fff")
      .style("stroke-width", "2px")
      .each(function (d) { this._current = d; }); // store state

    pieCharts.push({
      pollutant: pollutants[i],
      svg,
      paths,
      pie,
      arc,
      color
    });
  }
}

async function updateEmissionPieCharts(countryName, year) {
  const PIE_CATEGORIES = ["CO2", "N2O", "CH4"];

  for (const chart of pieCharts) {
    const files = PIE_CATEGORIES.map(c =>
      `Dataset/Environment/Urban developement (${c}) emissions from ${chart.pollutant} (Energy) (Mt CO2e).csv`
    );

    const datasets = await Promise.all(files.map(f => d3.csv(f)));

    const pieData = [];

    datasets.forEach((dataset, i) => {
      const row = dataset.find(d => d["Country Name"] === countryName);
      pieData.push({
        category: PIE_CATEGORIES[i],
        value: row && row[year] ? +row[year] : 0
      });
    });

    const newData = chart.pie(pieData);

    chart.paths
      .data(newData)
      .transition()
      .duration(750)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(1);
        return t => chart.arc(interpolate(t));
      });

    // update <title>
    chart.paths.select("title").remove();
    chart.paths.append("title")
      .text(d =>
        `${d.data.category}: ${d.data.value.toFixed(2)} Mt CO₂e`
      );
  }
}
function animateNumber(el, start, end, duration = 800) {
  d3.select(el)
    .transition()
    .duration(duration)
    .tween("text", function () {
      const i = d3.interpolateNumber(start, end);
      return function (t) {
        this.textContent = i(t).toFixed(1);
      };
    });
}
// animateNumber("#kpi-food-agri", 0, latestFood.value);
// animateNumber("#kpi-crop", 0, latestCrop.value);

async function drawEmissionRadar(countryA, countryB, gas) {

  const chartDiv = d3.select(`#radarChart-${gas}`);
  chartDiv.selectAll("*").remove();

  const emissionFiles = emissionConfig[gas];
  const datasets = await Promise.all(emissionFiles.map(d => d3.csv(d.file)));

  const countries = [countryA, countryB];
  const years = new Set();
  const data = {};
  countries.forEach(c => data[c] = {});

  datasets.forEach((dataset, i) => {
    countries.forEach(country => {
      const row = dataset.find(d => d["Country Name"] === country);
      if (!row) return;

      Object.entries(row)
        .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
        .forEach(([year, value]) => {
          year = +year;
          years.add(year);
          if (!data[country][year]) data[country][year] = {};
          data[country][year][emissionFiles[i].axis] = +value;
        });
    });
  });

  const yearList = Array.from(years).sort((a, b) => a - b);

  /***************************************
   * SHARED SLIDER
   ***************************************/
  const slider = d3.select("#yearSlidercompare")
    .attr("min", d3.min(yearList))
    .attr("max", d3.max(yearList))
    .attr("step", 1)
    .property("value", yearList[0]);

  const yearLabel = d3.select("#yearLabelcompare")
    .text(yearList[0]);

  /***************************************
   * RADAR SETUP
   ***************************************/
  const width = 380;
  const height = 380;
  const radius = Math.min(width, height) / 2 - 60;

  const svg = chartDiv.append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const axes = emissionFiles.map(d => d.axis);
  const angleSlice = (2 * Math.PI) / axes.length;

  const rScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, radius]);

  d3.range(1, 6).forEach(i => {
    svg.append("circle")
      .attr("r", radius * i / 5)
      .attr("fill", "none")
      .attr("stroke", "#ccc");
  });

  axes.forEach((axis, i) => {
    const angle = i * angleSlice - Math.PI / 2;

    svg.append("line")
      .attr("x2", radius * Math.cos(angle))
      .attr("y2", radius * Math.sin(angle))
      .attr("stroke", "#999");

    svg.append("text")
      .attr("x", (radius + 18) * Math.cos(angle))
      .attr("y", (radius + 18) * Math.sin(angle))
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(axis);
    svg.append("text")
      .attr("class", "radar-title")
      .attr("x", 0)
      .attr("y", height / 2 - 15)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text(gasTitles[gas]);

  });

  const radarLine = d3.lineRadial()
    .radius(d => rScale(d.value))
    .angle((d, i) => i * angleSlice - Math.PI / 2)
    .curve(d3.curveLinearClosed);

  const colors = {
    [countryA]: "#1f77b4",
    [countryB]: "#d62728"
  };
  /***************************************
 * LEGEND
 ***************************************/
  const legend = svg.append("g")
    .attr("class", "radar-legend")
    .attr("transform", `translate(${-width / 2 + 10},${-height / 2 })`);

  const legendItem = legend.selectAll(".legend-item")
    .data(countries)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 18})`);

  legendItem.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("rx", 2)
    .attr("fill", d => colors[d]);

  legendItem.append("text")
    .attr("x", 18)
    .attr("y", 10)
    .style("font-size", "12px")
    .style("alignment-baseline", "middle")
    .text(d => d);

  function updateRadar(year) {

  // 1️⃣ Compute a shared max across BOTH countries
  const maxThisYear = d3.max(
    countries.flatMap(country =>
      axes.map(axis => data[country][year]?.[axis] ?? 0)
    )
  ) || 1;

  // 2️⃣ Build radar data using the shared max
  const radarData = countries.map(country => ({
    country,
    values: axes.map(axis => ({
      axis,
      value: (data[country][year]?.[axis] ?? 0) / maxThisYear
    }))
  }));

  const paths = svg.selectAll(".radar-area")
    .data(radarData, d => d.country);

  paths.enter()
    .append("path")
    .attr("class", "radar-area")
    .attr("fill-opacity", 0.35)
    .attr("stroke-width", 2)
    .merge(paths)
    .transition()
    .duration(400)
    .attr("d", d => radarLine(d.values))
    .attr("fill", d => colors[d.country])
    .attr("stroke", d => colors[d.country]);

  paths.exit().remove();
}
  radarUpdaters[gas] = updateRadar;


  const initialYear = yearList[0];
  updateRadar(initialYear);
  d3.select("#yearSlidercompare").property("value", initialYear);
  yearLabel.text(initialYear);
}
d3.select("#yearSlidercompare").on("input", function () {
  const year = +this.value;
  d3.select("#yearLabelcompare").text(year);

  Object.values(radarUpdaters).forEach(update => update(year));
});
async function compareEconomy(countryA, countryB, economymode = "gdp") {

  const container = d3.select("#compareGdpChart");

  const config = {
    gdp: {
      file: "Dataset/Economy/Economy_GDP(current US$).csv",
      yLabel: "GDP (current US$)",
      tickFormat: d3.format(".2s")
    },
    growth: {
      file: "Dataset/Economy/Economy_GDP growth (annual _).csv",
      yLabel: "GDP Growth (annual %)",
      tickFormat: d => d + "%"
    }
  };

  const { file, yLabel, tickFormat } = config[economymode];
  const data = await d3.csv(file);

  const rowA = data.find(d => d["Country Name"] === countryA);
  const rowB = data.find(d => d["Country Name"] === countryB);
  if (!rowA || !rowB) return;

  const extract = row =>
    Object.entries(row)
      .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
      .map(([k, v]) => ({ year: +k, value: +v }))
      .sort((a, b) => a.year - b.year);

  const dataA = extract(rowA);
  const dataB = extract(rowB);

  const margin = { top: 20, right: 40, bottom: 40, left: 70 };
  const width = 700 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  /* ---------- INITIAL CREATE ---------- */
  if (!economyChart.svg) {
    container.selectAll("*").remove();

    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent([...dataA, ...dataB], d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .range([height, 0]);

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    const xAxisG = svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    const yAxisG = svg.append("g");

    const pathA = svg.append("path")
      .attr("fill", "none")
      .attr("stroke", "#4e79a7")
      .attr("stroke-width", 2.5);

    const pathB = svg.append("path")
      .attr("fill", "none")
      .attr("stroke", "#e15759")
      .attr("stroke-width", 2.5);
    // ---------- Legend ----------
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${margin.left + 20}, ${margin.top - 10})`);
    // Legend data for first country and second country
    const legendData = [
      { label: countryA, color: "#4e79a7", type: "line" },
      { label: countryB, color: "#e15759", type: "line" }
      
    ];

    const legendItem = legend.selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    // Line symbol
    legendItem.filter(d => d.type === "line")
      .append("line")
      .attr("x1", 0)
      .attr("x2", 25)
      .attr("y1", 8)
      .attr("y2", 8)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 3);

    // Rectangle symbol
    legendItem.filter(d => d.type === "rect")
      .append("rect")
      .attr("x", 0)
      .attr("y", 2)
      .attr("width", 25)
      .attr("height", 12)
      .attr("fill", d => d.color)
      .attr("opacity", 0.85);

    // Text labels
    legendItem.append("text")
      .attr("x", 35)
      .attr("y", 12)
      .style("font-size", "12px")
      .text(d => d.label);

    economyChart = { svg, x, y, line, pathA, pathB, xAxisG, yAxisG };
  }

  /* ---------- UPDATE WITH TRANSITION ---------- */
  const { svg, x, y, line, pathA, pathB, xAxisG, yAxisG } = economyChart;
  // Update domains
  x.domain(d3.extent([...dataA, ...dataB], d => d.year));
  y.domain([
    d3.min([...dataA, ...dataB], d => d.value),
    d3.max([...dataA, ...dataB], d => d.value)
  ]).nice();

  const t = d3.transition()
    .duration(900)
    .ease(d3.easeCubicInOut);

  // Axes
  xAxisG.transition(t)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  yAxisG.transition(t)
    .call(d3.axisLeft(y).ticks(6).tickFormat(tickFormat));

  // Lines
  pathA.datum(dataA)
    .transition(t)
    .attr("d", line);

  pathB.datum(dataB)
    .transition(t)
    .attr("d", line);

  // Update legend country names
  economyChart.svg
    .selectAll(".legend-item text")
    .data([countryA, countryB])
    .text(d => d);
  }

const gasTitles = {
  co2: "CO₂ Emissions by Sector",
  n2o: "N₂O Emissions by Sector",
  ch4: "CH₄ Emissions by Sector"
};

const emissionConfig = {
  co2: [
    {
      axis: "Industrial Combustion",
      file: "Dataset/Environment/Urban developement (CO2) emissions from Industrial Combustion (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Transport",
      file: "Dataset/Environment/Urban developement (CO2) emissions from Transport (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Power Industry",
      file: "Dataset/Environment/Urban developement (CO2) emissions from Power Industry (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Building",
      file: "Dataset/Environment/Urban developement (CO2) emissions from Building (Energy) (Mt CO2e).csv"
    }
  ],

  n2o: [
    {
      axis: "Industrial Combustion",
      file: "Dataset/Environment/Urban developement (N2O) emissions from Industrial Combustion (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Transport",
      file: "Dataset/Environment/Urban developement (N2O) emissions from Transport (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Power Industry",
      file: "Dataset/Environment/Urban developement (N2O) emissions from Power Industry (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Building",
      file: "Dataset/Environment/Urban developement (N2O) emissions from Building (Energy) (Mt CO2e).csv"
    }
  ],

  ch4: [
    {
      axis: "Industrial Combustion",
      file: "Dataset/Environment/Urban developement (CH4) emissions from Industrial Combustion (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Transport",
      file: "Dataset/Environment/Urban developement (CH4) emissions from Transport (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Power Industry",
      file: "Dataset/Environment/Urban developement (CH4) emissions from Power Industry (Energy) (Mt CO2e).csv"
    },
    {
      axis: "Building",
      file: "Dataset/Environment/Urban developement (CH4) emissions from Building (Energy) (Mt CO2e).csv"
    }
  ],
};

async function compareProduction(countryA, countryB, prodmode = "crop") {
  const container = d3.select("#compareProdChart");

  const config_prod = {
    crop: {
      file: "Dataset/Agriculture/Agriculture and Rural development_Crop production index (2014-2016 = 100).csv",
      yLabel: "Crop Production Index (2014-2016 = 100)",
      tickFormat: d3.format(".2s")
    },
    food: {
      file: "Dataset/Agriculture/Agriculture and Rural development_Food production index (2014-2016 = 100).csv",
      yLabel: "Food Production Index (2014-2016 = 100)",
      tickFormat: d3.format(".2s")
    }
  };

  const { file, yLabel, tickFormat } = config_prod[prodmode];
  const data = await d3.csv(file);

  const rowA = data.find(d => d["Country Name"] === countryA);
  const rowB = data.find(d => d["Country Name"] === countryB);
  if (!rowA || !rowB) return;

  const extract = row =>
    Object.entries(row)
      .filter(([k, v]) => /^\d{4}$/.test(k) && v !== "")
      .map(([k, v]) => ({ year: +k, value: +v }))
      .sort((a, b) => a.year - b.year);

  const dataA = extract(rowA);
  const dataB = extract(rowB);

  const margin = { top: 20, right: 40, bottom: 40, left: 70 };
  const width = 700 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  /* ---------- INITIAL CREATE ---------- */
  if (!economyChart.svg) {
    container.selectAll("*").remove();

    const svg_prod = container .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent([...dataA, ...dataB], d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .range([height, 0]);

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    const xAxisG = svg_prod.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    const yAxisG = svg_prod.append("g");
    const pathA = svg_prod.append("path")
      .attr("fill", "none")
      .attr("stroke", "#4e79a7")
      .attr("stroke-width", 2.5);

    const pathB = svg_prod.append("path")
      .attr("fill", "none")
      .attr("stroke", "#e15759")
      .attr("stroke-width", 2.5);

    // prodChart = { svg, x, y, line, pathA, pathB, yAxisG };
    // ---------- Legend ----------
    const legend = svg_prod.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${margin.left + 20}, ${margin.top - 10})`);
    // Legend data for first country and second country
    const legendData = [
      { label: countryA, color: "#4e79a7", type: "line" },
      { label: countryB, color: "#e15759", type: "line" }
      
    ];

    const legendItem = legend.selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    // Line symbol
    legendItem.filter(d => d.type === "line")
      .append("line")
      .attr("x1", 0)
      .attr("x2", 25)
      .attr("y1", 8)
      .attr("y2", 8)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 3);

    // Rectangle symbol
    legendItem.filter(d => d.type === "rect")
      .append("rect")
      .attr("x", 0)
      .attr("y", 2)
      .attr("width", 25)
      .attr("height", 12)
      .attr("fill", d => d.color)
      .attr("opacity", 0.85);

    // Text labels
    legendItem.append("text")
      .attr("x", 35)
      .attr("y", 12)
      .style("font-size", "12px")
      .text(d => d.label);

    prodChart = { svg_prod, x, y, line, pathA, pathB, xAxisG, yAxisG };
  }

  /* ---------- UPDATE WITH TRANSITION ---------- */



  const { svg_prod, x, y, line, pathA, pathB, xAxisG, yAxisG } = prodChart;
  x.domain(d3.extent([...dataA, ...dataB], d => d.year));
  
  y.domain([
    d3.min([...dataA, ...dataB], d => d.value),
    d3.max([...dataA, ...dataB], d => d.value)
  ]).nice();

  const t = d3.transition()
    .duration(900)
    .ease(d3.easeCubicInOut);

  xAxisG.transition(t)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  yAxisG.transition(t)
    .call(d3.axisLeft(y).ticks(6).tickFormat(tickFormat));

  pathA.datum(dataA)
    .transition(t)
    .attr("d", line);

  pathB.datum(dataB)
    .transition(t)
    .attr("d", line);

  prodChart.svg
    .selectAll(".legend-item text")
    .data([countryA, countryB])
    .text(d => d);
    }