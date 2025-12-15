const AGE_GROUPS = [
  "00-04","05-09","10-14","15-19","20-24","25-29","30-34",
  "35-39","40-44","45-49","50-54","55-59","60-64","65-69",
  "70-74","75-79","80_and_above"
];
async function showCharts(countryName) {
  await drawPopulationPyramid(countryName);
  await drawGDPChart(countryName);
  await drawCO2Chart(countryName);
  await drawEmissionChart(countryName);
}

async function drawPopulationPyramid(countryName) {
  const pyramidDiv = d3.select("#pyramidChart");
  pyramidDiv.selectAll("*").remove(); // Clear existing chart

  try {
    // Load the data from all age group CSV files
    const rawData = await Promise.all(
    AGE_GROUPS.map(ageGroup =>
        d3.csv(`DataSet/Health/Health_Population_ages_${ageGroup}_male_of_male_population.csv`)
            .then(data => ({ ageGroup, data }))  // Include the ageGroup with the data
    )
);
    // Transform the data for the pyramid chart
    const pyramidData = transformDataForPopulationPyramid(rawData, countryName);
    createPopulationChart(pyramidData);
  } catch (err) {
    console.error("Error loading population dat:", err);
    pyramidDiv.append("p").text("Failed to load population data.");
  }
}

function transformDataForPopulationPyramid(file, countryName) {
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

function createPopulationChart(countryData) {
  console.log("countryDataa");
  console.log(countryData);
  const margin = {top: 20, right: 40, bottom: 50, left: 70};
  const width = 700 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svgEl = d3.select("#pyramidChart");
   const ctx = {
    hmargin: 20,
    vmargin: 5,
    yearAxisHeight: 30,
    totalStripPlotHeight: 500,
    GREY_NULL: "#ccc",
    crossSeriesTempExtent: [0, 100], // Adjust based on your data range
    timeParser: d3.timeParse("%Y"),
    REFERENCE_YEAR: "2020"
};
// Get the min and max value for color scale
ctx.crossSeriesTempExtent = [
    d3.min(countryData, (d) => d3.min(d, (item) => item.value)),  // Assuming each item in d has a 'value' key
    d3.max(countryData, (d) => d3.max(d, (item) => item.value))   // Same assumption for max value
];
console.log("**");
console.log(ctx.crossSeriesTempExtent[0]);

// Color scale based on values
ctx.color = d3.scaleLinear()
    .domain([ctx.crossSeriesTempExtent[0], 0, ctx.crossSeriesTempExtent[1]])
    .range(["rgb(0, 51, 255)", "#f5f5f5", "rgb(255, 57, 57)"]);

// Define the height of each strip for each age group
ctx.STRIP_H = (ctx.totalStripPlotHeight - ctx.yearAxisHeight) / countryData.length;

// Loop over each dataset in result (each corresponding to a different age group)
countryData.forEach(function(d, i) {
    console.log("****");
    console.log(d);
    let mapG = svgEl.append("g")
        .classed("plot", true)
        .attr("transform", `translate(${ctx.hmargin},${i * ctx.STRIP_H})`);
    
    // Create lines for each country's values for this age group
    mapG.selectAll("line")
        .data(d.dataOverYear)
        .enter()
        .append("line")
        .attr("x1", (d, j) => ctx.timeParser(d.dataOverYear))  // Assuming `year` is a key in country data
        .attr("y1", ctx.vmargin)
        .attr("x2", (d, j) => ctx.timeParser(d.dataOverYear))  // Same as x1
        .attr("y2", ctx.STRIP_H - ctx.vmargin)
        .attr("stroke", (d) => (d.value == null ? ctx.GREY_NULL : ctx.color(d.value)))  // Color by value
        .attr("stroke-width", 2);

    // Add age group label
    mapG.append("text")
        .attr("x", d.country.length + 2 * ctx.hmargin)
        .attr("y", ctx.STRIP_H - ctx.vmargin - 3)
        .text(d.ageGroup);
});

// Time axis
let timeScale = d3.scaleTime()
    .domain(d3.extent(countryData[0].country, (d) => ctx.timeParser(d.year)))  // Assuming all countries have same year range
    .rangeRound([0, countryData[0].country.length - 1]);

svgEl.append("g")
    .attr("id", "yearAxis")
    .attr("transform", `translate(${ctx.hmargin},${ctx.totalStripPlotHeight - ctx.yearAxisHeight})`)
    .call(d3.axisBottom(timeScale).ticks(d3.timeYear.every(5)));

// Legend for values (temperature in the original example)
let tempRange4legend = d3.range(ctx.crossSeriesTempExtent[0], ctx.crossSeriesTempExtent[1], 0.15).reverse();
let scale4tempLegend = d3.scaleLinear()
    .domain(ctx.crossSeriesTempExtent)
    .rangeRound([tempRange4legend.length, 0]);

let legendG = svgEl.append("g")
    .attr("id", "tempScale")
    .attr("opacity", 1)
    .attr("transform", `translate(1000,${ctx.totalStripPlotHeight / 2 - tempRange4legend.length / 2})`);

legendG.selectAll("line")
    .data(tempRange4legend)
    .enter()
    .append("line")
    .attr("x1", 0)
    .attr("y1", (d, j) => (j))
    .attr("x2", ctx.STRIP_H)
    .attr("y2", (d, j) => (j))
    .attr("stroke", (d) => (ctx.color(d)));

// Add axis for the legend
legendG.append("g")
    .attr("transform", `translate(${ctx.STRIP_H + 4},0)`)
    .call(d3.axisRight(scale4tempLegend).ticks(5));

// Add legend label
legendG.append("text")
    .attr("x", 40)
    .attr("y", tempRange4legend.length / 2)
    .style("fill", "#aaa")
    .text(`(Reference: ${ctx.REFERENCE_YEAR})`);
}


async function drawGDPChart(countryName) {
  const gdpDiv = d3.select("#gdpChart");
  gdpDiv.selectAll("*").remove(); // clear

  try {
    const data = await d3.csv("Dataset/Economy/Economy_GDP(current US$).csv");
    const countryData = data.find(d => d["Country Name"] === countryName);
    if (!countryData) {
      gdpDiv.append("p").text("No GDP data found for this country.");
      return;
    }

    // Extract year-value pairs
    const gdpValues = Object.entries(countryData)
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
    const height = 400 - margin.top - margin.bottom;

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
  } catch (err) {
    console.error("Error loading GDP data:", err);
    gdpDiv.append("p").text("Failed to load GDP data.");
  }
}

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
    const margin = {top: 20, right: 40, bottom: 40, left: 70};
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

async function drawEmissionChart(countryName) {
  const emissionDiv = d3.select("#emissionChart");
  emissionDiv.selectAll("*").remove();

  const files = [
    "Dataset/Environment/Urban developement_Carbon dioxide (CO2) emissions from Industrial Processes (Mt CO2e).csv",
    "Dataset/Environment/Urban developement_Carbon dioxide (CO2) emissions from Transport (Energy) (Mt CO2e).csv",
    "Dataset/Environment/Urban developement_Carbon dioxide (CO2) emissions from Power Industry (Energy) (Mt CO2e).csv",
    "Dataset/Environment/Urban developement_Carbon dioxide (CO2) emissions from Building (Energy) (Mt CO2e).csv"
  ];

  const seriesNames = ["Industrial Processes", "Transport", "Energy Process", "Building"];
  const colors = ["#1f77b4", "#ff7f0e", "#e21661ff","#2ca02c"];

  try {
    const datasets = await Promise.all(files.map(f => d3.csv(f)));

    const dataByYear = {};
    datasets.forEach((dataset, i) => {
      const row = dataset.find(d => d["Country Name"] === countryName);
      if (!row) return;

      Object.entries(row)
        .filter(([key, val]) => /^\d{4}$/.test(key) && val !== "")
        .forEach(([year, val]) => {
          if (!dataByYear[year]) dataByYear[year] = { year: +year };
          dataByYear[year][seriesNames[i]] = +val;
        });
    });

    const data = Object.values(dataByYear)
      .filter(d => seriesNames.some(s => d[s] !== undefined))
      .sort((a, b) => a.year - b.year);

    if (data.length === 0) {
      emissionDiv.append("p").text("No emission data found for this country.");
      return;
    }

    const margin = {top: 20, right: 80, bottom: 40, left: 60};
    const width = 700 - margin.left - margin.right;
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
      .domain([0, d3.max(data, d => Math.max(...seriesNames.map(s => d[s] || 0)))])
      .nice()
      .range([height, 0]);

    const line = d3.line()
      .x(d => x(d.year))
      .y((d, i, nodes) => y(d.value));

    // series
    seriesNames.forEach((name, idx) => {
      const lineData = data.map(d => ({ year: d.year, value: d[name] || 0 }));

      svg.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", colors[idx])
        .attr("stroke-width", 2.5)
        .attr("d", d3.line()
          .x(d => x(d.year))
          .y(d => y(d.value))
          .curve(d3.curveMonotoneX)
        );

      // dot
      svg.selectAll(`.dot-${idx}`)
        .data(lineData)
        .enter().append("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.value))
        .attr("r", 3)
        .attr("fill", colors[idx]);
    });

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
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .text("CO₂ Emissions (Mt CO2e)");

    // Legend
    const legend = svg.selectAll(".legend")
      .data(seriesNames)
      .enter().append("g")
      .attr("transform", (d, i) => `translate(${width + 20},${20 + i*20})`);

    legend.append("rect")
      .attr("width", 12).attr("height", 12)
      .attr("fill", (d,i) => colors[i]);

    legend.append("text")
      .attr("x", 18)
      .attr("y", 10)
      .text(d => d);
  } catch (err) {
    console.error("Error loading emission data:", err);
    emissionDiv.append("p").text("Failed to load emission data.");
  }
}
