let currency = "USD";
let symbol = "$";
let allCoins = [];
let chart;
let selectedCoinId = "";
let chartDays = 1;
let portfolio = [];

$(document).ready(function () {
  if (localStorage.getItem("loggedIn") === "true") {
    showMainApp();
  }

  $("#loginForm").on("submit", function (e) {
    e.preventDefault();
    const name = $("#name").val().trim();
    const roll = $("#rollNumber").val().trim();

    if (name && roll) {
      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("name", name);
      localStorage.setItem("roll", roll);
      showMainApp();
    } else {
      alert("Please fill in both fields.");
    }
  });

  $("#logoutBtn").on("click", function () {
    localStorage.clear();
    location.reload();
  });

  $("#currencySelector").on("change", function () {
    currency = $(this).val();
    symbol = currency === "INR" ? "₹" : "$";
    fetchTrendingCoins();
    fetchCoinList();
    if (selectedCoinId) fetchChartData(selectedCoinId);
    if (portfolio.length > 0) updatePortfolioDisplay();
  });

  $("#searchInput").on("input", function () {
    renderTable($(this).val());
  });

  $("#chartRange button").on("click", function () {
    chartDays = $(this).data("days");
    $("#chartRange button").removeClass("active");
    $(this).addClass("active");
    fetchChartData(selectedCoinId);
  });

  $("#portfolioForm").on("submit", function (e) {
    e.preventDefault();
    const coinId = $("#coinSelector").val();
    const amount = parseFloat($("#amountOwned").val());
    if (!amount || amount <= 0) {
      alert("Enter a valid amount.");
      return;
    }
    addToPortfolio(coinId, amount);
    $("#amountOwned").val("");
  });
});

function showMainApp() {
  $("#loginSection").hide();
  $("#mainContent").show();

  const name = localStorage.getItem("name");
  const roll = localStorage.getItem("roll");
  $("#userInfo").html(`Welcome, <strong>${name}</strong> (${roll})`);

  fetchTrendingCoins();
  fetchCoinList();
}

function fetchTrendingCoins() {
  $.get(`https://api.coingecko.com/api/v3/coins/markets`, {
    vs_currency: currency,
    order: "gecko_desc",
    per_page: 10,
    page: 1,
    sparkline: false,
    price_change_percentage: "24h",
  }).then((data) => {
    $(".carousel").empty();
    data.forEach((coin) => {
      const profit = coin.price_change_percentage_24h >= 0;
      $(".carousel").append(`
        <div class="coin-slide" style="text-align:center; color:white;">
          <img src="${coin.image}" height="50"/>
          <p style="margin: 5px 0;">${coin.symbol.toUpperCase()} 
            <span style="color:${profit ? 'lime' : 'red'};">
              ${profit ? '+' : ''}${coin.price_change_percentage_24h.toFixed(2)}%
            </span>
          </p>
          <strong>${symbol}${coin.current_price.toLocaleString()}</strong>
        </div>
      `);
    });
    $(".carousel").slick({
      slidesToShow: 4,
      autoplay: true,
      autoplaySpeed: 2000,
      arrows: false,
    });
  });
}

function fetchCoinList() {
  $.get(`https://api.coingecko.com/api/v3/coins/markets`, {
    vs_currency: currency,
    order: "market_cap_desc",
    per_page: 100,
    page: 1,
    sparkline: false,
  }).then((data) => {
    allCoins = data;
    renderTable();
    populateCoinDropdown();
  });
}

function renderTable(search = "") {
  const filtered = allCoins.filter((coin) =>
    coin.name.toLowerCase().includes(search.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(search.toLowerCase())
  );

  let html = `
    <table>
      <thead>
        <tr>
          <th>Coin</th>
          <th>Price</th>
          <th>24h Change</th>
          <th>Market Cap</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach((coin) => {
    const profit = coin.price_change_percentage_24h >= 0;
    html += `
      <tr onclick="selectCoin('${coin.id}', '${coin.name}')">
        <td><img src="${coin.image}" height="25" style="vertical-align:middle; margin-right:8px;" />${coin.name} (${coin.symbol.toUpperCase()})</td>
        <td>${symbol}${coin.current_price.toLocaleString()}</td>
        <td style="color:${profit ? 'lime' : 'red'};">${profit ? '+' : ''}${coin.price_change_percentage_24h.toFixed(2)}%</td>
        <td>${symbol}${(coin.market_cap / 1_000_000).toFixed(0)}M</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  $("#coinTableContainer").html(html);
}

function selectCoin(id, name) {
  selectedCoinId = id;
  $("#chartSection").show();
  $("#coinName").text(name);
  chartDays = 1;
  $("#chartRange button").removeClass("active");
  $("#chartRange button[data-days='1']").addClass("active");
  fetchChartData(id);
}

function fetchChartData(id) {
  $.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
    vs_currency: currency,
    days: chartDays,
  }).then((data) => {
    const prices = data.prices;
    const labels = prices.map(([time]) => {
      const date = new Date(time);
      return chartDays === 1
        ? `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`
        : date.toLocaleDateString();
    });

    const values = prices.map(([, value]) => value);

    if (chart) chart.destroy();
    const ctx = document.getElementById("priceChart").getContext("2d");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          label: `Price (Last ${chartDays} Days) in ${currency}`,
          borderColor: "#EEBC1D",
          fill: false,
        }],
      },
      options: {
        responsive: true,
        elements: { point: { radius: 0 } },
        scales: { x: { display: true }, y: { display: true } },
      },
    });
  });
}

function populateCoinDropdown() {
  $("#coinSelector").empty();
  allCoins.forEach((coin) => {
    $("#coinSelector").append(
      `<option value="${coin.id}">${coin.name} (${coin.symbol.toUpperCase()})</option>`
    );
  });
  $("#portfolioSection").show();
}

function addToPortfolio(coinId, amount) {
  $.get(`https://api.coingecko.com/api/v3/simple/price`, {
    ids: coinId,
    vs_currencies: currency,
  }).then((data) => {
    const price = data[coinId][currency.toLowerCase()];
    const value = price * amount;
    portfolio.push({ coinId, amount, price, value });
    updatePortfolioDisplay();
  });
}

function updatePortfolioDisplay() {
  let total = 0;
  let html = "<ul>";
  portfolio.forEach((item) => {
    total += item.value;
    html += `<li>${item.amount} ${item.coinId.toUpperCase()} = ${symbol}${item.value.toFixed(2)}</li>`;
  });
  html += "</ul>";
  $("#portfolioList").html(html);
  $("#totalValue").text(`${symbol}${total.toFixed(2)}`);
}
