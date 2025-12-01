const AGE_GROUPS = [
  "00-04","05-09","10-14","15-19","20-24","25-29","30-34",
  "35-39","40-44","45-49","50-54","55-59","60-64","65-69",
  "70-74","75-79","80_and_above"
];
async function showCharts(countryName) {
    // loadPopulationDataAndDraw(countryName);
    drawGDPChart(countryName);
    drawCO2Chart(countryName);
    drawEmissionChart(countryName);
}

async function loadPopulationDataAndDraw(countryName) {
  const container = d3.select("#pyramidContainer");
  const title = d3.select("#pyramidTitle");
  const chartDiv = d3.select("#pyramidChart");
  chartDiv.selectAll("*").remove();
  title.text(`Population Pyramid - ${countryName}`);
  container.style("display", "block");

  // Mảng dữ liệu cuối cùng
  const mergedData = [];

  for (const age of AGE_GROUPS) {
    const maleFile = `Dataset/Health/Health_Population_ages_${age}_male_of_male_population.csv`;
    const femaleFile = `Dataset/Health/Health_Population_ages_${age}_female_of_female_population.csv`;

    try {
      const [maleData, femaleData] = await Promise.all([
        d3.csv(maleFile),
        d3.csv(femaleFile)
      ]);

      // Giả sử mỗi file có cấu trúc: Country, Value
      const maleRow = maleData.find(d => d.Country === countryName);
      const femaleRow = femaleData.find(d => d.Country === countryName);

      if (maleRow && femaleRow) {
        mergedData.push({
          age: age.replace("_and_above", "+").replace("_", "-"),
          male: +maleRow.Value || 0,
          female: +femaleRow.Value || 0
        });
      }
    } catch (e) {
      console.warn("Error loading:", age, e);
    }
  }

  if (mergedData.length === 0) {
    chartDiv.append("p").text("No population data found for this country.");
    return;
  }

  drawPopulationPyramid(mergedData);
}

function drawPopulationPyramid(data) {
  const margin = {top: 20, right: 20, bottom: 30, left: 20};
  const width = 360 - margin.left - margin.right;
  const height = 280 - margin.top - margin.bottom;

  const svg = d3.select("#pyramidChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const maxValue = d3.max(data, d => Math.max(d.male, d.female));

  const x = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, width / 2])
    .nice();

  const y = d3.scaleBand()
    .domain(data.map(d => d.age))
    .range([height, 0])
    .padding(0.1);

  // Nam (bên trái)
  svg.selectAll(".bar.male")
    .data(data)
    .enter()
    .append("rect")
      .attr("class", "bar male")
      .attr("x", d => width/2 - x(d.male))
      .attr("y", d => y(d.age))
      .attr("width", d => x(d.male))
      .attr("height", y.bandwidth())
      .attr("fill", "#4f81bd");

  // Nữ (bên phải)
  svg.selectAll(".bar.female")
    .data(data)
    .enter()
    .append("rect")
      .attr("class", "bar female")
      .attr("x", width/2)
      .attr("y", d => y(d.age))
      .attr("width", d => x(d.female))
      .attr("height", y.bandwidth())
      .attr("fill", "#c0504d");

  // Trục giữa
  svg.append("line")
    .attr("x1", width / 2)
    .attr("x2", width / 2)
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#000");

  // Trục Y (tuổi)
  svg.append("g")
    .attr("transform", `translate(${width/2},0)`)
    .call(d3.axisRight(y).tickSize(0))
    .selectAll("text")
    .style("text-anchor", "middle");

  // Nhãn
  svg.append("text")
    .attr("x", width / 4)
    .attr("y", height + 20)
    .attr("text-anchor", "middle")
    .text("Male");

  svg.append("text")
    .attr("x", width * 3/4)
    .attr("y", height + 20)
    .attr("text-anchor", "middle")
    .text("Female");
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

    svg.append("path")
      .datum(gdpValues)
      .attr("fill", "none")
      .attr("stroke", "#28a745")
      .attr("stroke-width", 2.5)
      .attr("d", line);

    svg.selectAll(".dot")
      .data(gdpValues)
      .enter().append("circle")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", "#28a745");

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
