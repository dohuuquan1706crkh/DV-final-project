const AGE_GROUPS = [
  "00-04","05-09","10-14","15-19","20-24","25-29","30-34",
  "35-39","40-44","45-49","50-54","55-59","60-64","65-69",
  "70-74","75-79","80+"
];

const ctx = {};
let pieCharts = []; // store references to each pie
async function showCharts(countryName) {
  await drawPopulationPyramid(countryName);
  await drawGDPChart(countryName);
  await drawCO2Chart(countryName);
  
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


}

async function drawPopulationPyramid(countryName) {
  const pyramidDiv = d3.select("#pyramidChart");
  pyramidDiv.selectAll("*").remove(); // Clear existing chart

  try {
    // Load male + female data cho tất cả age groups
    const rawData = await Promise.all(
      AGE_GROUPS.map(async ageGroup => {
        const [maleData, femaleData] = await Promise.all([
          d3.csv(`DataSet/Health/Health_Population_ages_${ageGroup === "80+" ? "80_and_above" : ageGroup}_male_of_male_population.csv`),
          d3.csv(`DataSet/Health/Health_Population_ages_${ageGroup === "80+" ? "80_and_above" : ageGroup}_female_of_female_population.csv`)
        ]);

        // Tạo array mới với trung bình phần trăm male/female
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

    // Vẽ time serie cho các năm
    const totalData = rawData.map(group => ({
      ageGroup: group.ageGroup,
      data: group.total
    }));

    // console.log("total data");
    // console.log(totalData);

    ctx.heatData = transformDataForHeatmap(totalData, countryName);
    createHeatMap(ctx.heatData);

    // Vẽ cho một năm biểu đồ piramid

    ctx.genderData = rawData.map(group => ({
      ageGroup: group.ageGroup,
      male: group.male,
      female: group.female
    }));

    const pyramidData = transformDataForPyramid(ctx.genderData, countryName, 2020);
    // createPyramidData(pyramidData);
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
    console.log("file");
    console.log(file);
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
  console.log("countryDataa");
  console.log(countryData);
  // Chuyển dữ liệu từ object -> array để dễ vẽ
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

    // Kích thước chart
    const margin = { top: 50, right: 110, bottom: 50, left: 80 },
          width = 800 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

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
    console.log("file");
    console.log(file);
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
  height = 500 - margin.top - margin.bottom;

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
const legend = wrapper.append("div")
  .style("margin-top", "6px")
  .style("font-size", "12px")
  .style("display", "flex")
  .style("justify-content", "center")
  .style("gap", "12px");

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
    chart.paths
  .data(newData)
  .transition()
  .duration(750)
  .attrTween("d", function (d) {
    const i = d3.interpolate(this._current, d);
    this._current = i(1);
    return t => chart.arc(i(t));
  });

}

document.getElementById("updateBtn-pyramid").addEventListener("click", () => {
  const raw = parseInt(document.getElementById("yearInput-pyramid").value);
  const year = Number.isFinite(raw) ? raw : 2020;

  const pyramidData = transformDataForPyramid(ctx.genderData, countryName, year);
  updatePyramidData(pyramidData);
});


// ----------------------------
// GDP chart
// ----------------------------

async function drawGDPChart(countryName) {
  const gdpDiv = d3.select("#gdpChart");
  gdpDiv.selectAll("*").remove(); // clear

  try {
    const currentGDP = await d3.csv("Dataset/Economy/Economy_GDP(current US$).csv");
    const growthGDP = await d3.csv("Dataset/Economy/Economy_GDP growth (annual _).csv");
    const countryCurrentData = currentGDP.find(d => d["Country Name"] === countryName);
    const countryGrowthGDP = growthGDP.find(d => d["Country Name"] === countryName);
    if (!countryCurrentData && !countryGrowthGDP) {
      gdpDiv.append("p").text("No GDP data found for this country.");
      return;
    }

    // Extract year-value pairs
    const gdpValues = Object.entries(countryCurrentData)
      .filter(([key, val]) => /^\d{4}$/.test(key) && val !== "")
      .map(([year, val]) => ({
        year: +year,
        value: +val
      }))
      .filter(d => !isNaN(d.value));

    if (gdpValues.length === 0) {
      gdpDiv.append("p").text("No GDP data available.");
      return;
    }

    // Sort by year
    gdpValues.sort((a, b) => a.year - b.year);

    const margin = {top: 20, right: 40, bottom: 40, left: 70};
    const width = 700 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = gdpDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(gdpValues, d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(gdpValues, d => d.value)])
      .nice()
      .range([height, 0]);

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    const path = svg.append("path")
      .datum(gdpValues)
      .attr("fill", "none")
      .attr("stroke", "#28a745")
      .attr("stroke-width", 2.5)
      .attr("d", line);

    path.transition()
      .duration(500) // 1.5 seconds for transition duration
      .ease(d3.easeCubicOut); // Ease function for smooth transition

    svg.selectAll(".dot")
      .data(gdpValues)
      .enter().append("circle")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", "#28a745")
      .transition()
      .duration(500)
      .delay((d, i) => i * 50)
      .attr("opacity", 1);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".2s")));

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .text("Year");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .text("GDP (current US$)");

    // Extract year-value pairs
    const gdpGrowth = Object.entries(countryGrowthGDP)
      .filter(([key, val]) => /^\d{4}$/.test(key) && val !== "")
      .map(([year, val]) => ({
        year: +year,
        value: +val
      }))
      .filter(d => !isNaN(d.value));

    if (gdpGrowth.length === 0) {
      gdpDiv.append("p").text("No GDP data available.");
      return;
    }

    // Sort by year
    gdpGrowth.sort((a, b) => a.year - b.year);

    const svg1 = gdpDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x1 = d3.scaleLinear()
      .domain(d3.extent(gdpGrowth, d => d.year))
      .range([0, width]);

    const y1 = d3.scaleLinear()
      .domain([d3.min(gdpGrowth, d => d.value), d3.max(gdpGrowth, d => d.value)])
      .nice()
      .range([height, 0]);

    const line1 = d3.line()
      .x(d => x1(d.year))
      .y(d => y1(d.value))
      .curve(d3.curveMonotoneX);

    const path1 = svg1.append("path")
      .datum(gdpGrowth)
      .attr("fill", "none")
      .attr("stroke", "#002ebaff")
      .attr("stroke-width", 2.5)
      .attr("d", line1);

    svg1.selectAll(".dot")
      .data(gdpGrowth)
      .enter().append("circle")
      .attr("cx", d => x1(d.year))
      .attr("cy", d => y1(d.value))
      .attr("r", 3)
      .attr("fill", "#002ebaff")
      .transition()
      .duration(500)
      .delay((d, i) => i * 50)
      .attr("opacity", 1);

    svg1.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x1).tickFormat(d3.format("d")));

    svg1.append("g")
      .call(d3.axisLeft(y1).ticks(6).tickFormat(d3.format(".2s")));

    svg1.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .text("Year");

    svg1.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .text("GDP Growth (annual %)");

  } catch (err) {
    console.error("Error loading GDP data:", err);
    gdpDiv.append("p").text("Failed to load GDP data.");
  }
}

// ----------------------------
// Co2 chart
// ----------------------------

async function drawCO2Chart(countryName) {
  const co2Div = d3.select("#co2Chart");
  co2Div.selectAll("*").remove();

  try {
    const data = await d3.csv("Dataset/Environment/Urban_developement_Carbon_intensity_of_GDP_(kg_CO2e_per_constant_2015_US$_of_GDP).csv");
    const countryData = data.find(d => d["Country Name"] === countryName);
    if (!countryData) {
      co2Div.append("p").text("No CO₂ data found for this country.");
      return;
    }

    const co2Values = Object.entries(countryData)
      .filter(([key, val]) => /^\d{4}$/.test(key) && val !== "")
      .map(([year, val]) => ({ year: +year, value: +val }))
      .filter(d => !isNaN(d.value))
      .sort((a, b) => a.year - b.year);

    if (co2Values.length === 0) {
      co2Div.append("p").text("No CO₂ data available.");
      return;
    }
    const margin = {top: 20, right: 40, bottom: 20, left: 70};
    const width = 700 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = co2Div.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(co2Values, d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(co2Values, d => d.value)])
      .nice()
      .range([height, 0]);

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(co2Values)
      .attr("fill", "none")
      .attr("stroke", "#ff6600")
      .attr("stroke-width", 2.5)
      .attr("d", line);

    svg.selectAll(".dot")
      .data(co2Values)
      .enter().append("circle")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", "#ff6600");

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
      .call(d3.axisLeft(y));

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .text("Year");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .text("CO₂ (kg per US$ GDP)");
  } catch (err) {
    console.error("Error loading CO₂ data:", err);
    co2Div.append("p").text("Failed to load CO₂ data.");
  }
}

// ----------------------------
// emission chart
// ----------------------------

async function drawEmissionChart(countryName, emissionType) {

  const emissionDiv = d3.select("#emissionChart");
  emissionDiv.selectAll("*").remove();

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

  try {
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

    const data = Object.values(dataByYear)
      .sort((a, b) => a.year - b.year);

    if (!data.length) {
      emissionDiv.append("p").text("No emission data found.");
      return;
    }

    /* ======================
       CHART SETUP
    ====================== */

    const margin = { top: 20, right: 120, bottom: 40, left: 60 };
    const width = 1200 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = emissionDiv.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([
        0,
        d3.max(data, d => Math.max(...seriesNames.map(s => d[s] || 0)))
      ])
      .nice()
      .range([height, 0]);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
      .call(d3.axisLeft(y));

    /* ======================
       LINES
    ====================== */

    seriesNames.forEach((name, i) => {
      const lineData = data.map(d => ({
        year: d.year,
        value: d[name] || 0
      }));

      svg.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", colors[i])
        .attr("stroke-width", 2.5)
        .attr("d", d3.line()
          .x(d => x(d.year))
          .y(d => y(d.value))
          .curve(d3.curveMonotoneX)
        );
    });

    /* ======================
       LABELS
    ====================== */

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("text-anchor", "middle")
      .text("Year");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .text(`${emissionType} Emissions (Mt CO2e)`);

    /* ======================
       LEGEND
    ====================== */

    const legend = svg.selectAll(".legend")
      .data(seriesNames)
      .enter()
      .append("g")
      .attr("transform", (d, i) => `translate(${width + 20},${20 + i * 20})`);

    legend.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", (d, i) => colors[i]);

    legend.append("text")
      .attr("x", 18)
      .attr("y", 10)
      .text(d => d);

  } catch (err) {
    console.error(err);
    emissionDiv.append("p").text("Failed to load emission data.");
  }
}

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
      .style("text-align", "center");

    wrapper.append("div")
      .attr("class", "pie-title")
      .style("font-weight", "600")
      .style("margin-bottom", "6px")
      .text(pollutants[i]);

    const svg = wrapper.append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

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


// async function drawEmissionPieChart(countryName, year) {
//   const pollutant = ['Industrial Combustion', 'Transport', 'Power Industry', 'Building'];
//   const PIE_COLORS = [
//     "#4C6A92",
//     "#7A8F7A",
//     "#9FA6B2"
//   ];

//   const PIE_CATEGORIES = [
//     "CO2",
//     "N2O",
//     "CH4"
//   ]

//   const container = d3.select("#emissionPieChart");
//   container.selectAll("*").remove(); 
  
//     for (let i = 0; i < pollutant.length; i++) {
//       const files = PIE_CATEGORIES.map(c =>
//       `Dataset/Environment/Urban developement (${c}) emissions from ${pollutant[i]} (Energy) (Mt CO2e).csv`
//       );
//     try {
//       const datasets = await Promise.all(files.map(f => d3.csv(f)));
//       const pieData = [];

//       datasets.forEach((dataset, i) => {
//         const row = dataset.find(d => d["Country Name"] === countryName);
//         console.log(row);
//         if (!row || !row[year] || row[year] === "") return;

//         pieData.push({
//           category: PIE_CATEGORIES[i],
//           value: +row[year]
//         });
//       });

//       if (!pieData.length) {
//         container.append("pollutant[i]").text("No emission data available.");
//         return;
//       }

//       /* ======================
//         SVG SETUP
//       ====================== */

//       const width = 220;
//       const height = 220;
//       const radius = Math.min(width, height) / 2 - 20;
//       const svg = container.append("svg")
//       .attr("width", width)
//       .attr("height", height)
//       .append("g")
//       .attr("transform", `translate(${width / 2},${height / 2})`);

//       const color = d3.scaleOrdinal()
//           .domain(PIE_CATEGORIES)
//           .range(PIE_COLORS);



//       const pie = d3.pie()
//         .value(d => d.value)
//         .sort(null);

//       const arc = d3.arc()
//         .innerRadius(0)
//         .outerRadius(radius);

//       /* ======================
//         DRAW PIE
//       ====================== */

//       svg.selectAll("path")
//         .data(pie(pieData))
//         .enter()
//         .append("path")
//         .attr("d", arc)
//         .attr("fill", d => color(d.data.category))
//         .attr("stroke", "#fff")
//         .style("stroke-width", "2px")
//         .append("title")   
//         .text(d =>
//           `${d.data.category}: ${d.data.value.toFixed(2)} Mt CO₂e`
//         );


//       /* ======================
//         LABELS (CENTER)
//       ====================== */
//       const pieWrapper = container.append("div")
//       .style("width", "120px")
//       .style("text-align", "center");

//       pieWrapper.append("div")
//         .style("font-size", "14px")
//         .style("font-weight", "600")
//         .style("margin-bottom", "15px")
//         .text(`${pollutant[i]} emission in ${year}`);
      

//       /* ======================
//         LEGEND
//       ====================== */
//       const legend = pieWrapper.append("div")
//         .style("margin-top", "6px")
//         .style("font-size", "12px");

//       const legendItem = legend.selectAll(".legend-item")
//         .data(pieData)
//         .enter()
//         .append("div")
//         .style("display", "flex")
//         .style("align-items", "center")
//         .style("justify-content", "center")
//         .style("gap", "6px");

//       legendItem.append("span")
//         .style("width", "12px")
//         .style("height", "12px")
//         .style("background-color", d => color(d.category))
//         .style("display", "inline-block");

//       legendItem.append("span")
//         .text(d => d.category);

//     }
    
//   catch (err) {
//     console.error(err);
//     container.append("p").text("Failed to load pie chart data.");
//   }
//   } 
// }
