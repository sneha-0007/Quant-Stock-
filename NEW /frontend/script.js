/**
 * script.js – Chronos Stock
 * Full indicators: SMA, EMA9, RSI, MACD, Bollinger Bands
 */

const bankSelect      = document.getElementById('bankSelect');
const chartTypeSelect = document.getElementById('chartType');
const indicatorSelect = document.getElementById('indicator');
const stockNameEl     = document.getElementById('stockName');
const stockPriceEl    = document.getElementById('stockPrice');
const stockChangeEl   = document.getElementById('stockChange');
const predPriceEl     = document.getElementById('predPrice');
const actPriceEl      = document.getElementById('actPrice');
const confidenceEl    = document.getElementById('confidence');

// Live indicator display elements (in sidebar)
const elRSI   = document.getElementById('liveRSI');
const elMACD  = document.getElementById('liveMACD');
const elEMA   = document.getElementById('liveEMA');
const elBBU   = document.getElementById('liveBBU');
const elBBL   = document.getElementById('liveBBL');

const directionEl = document.getElementById('direction');
const entryEl = document.getElementById('entry');
const slEl = document.getElementById('stoploss');
const targetEl = document.getElementById('target');
const accuracyEl = document.getElementById('accuracy');

const chart = LightweightCharts.createChart(
    document.getElementById('priceChart'),
    {
        layout:    { background: { color: '#071226' }, textColor: '#DDD' },
        grid:      { vertLines: { color: '#1a2233' }, horzLines: { color: '#1a2233' } },
        crosshair: { mode: 1 },
        timeScale: { timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderColor: '#1a2233' },
    }
);

let candleSeries     = null;
let actualLineSeries = null;
let predictedLine    = null;
let volumeSeries     = null;
let indicatorSeries  = null;
let indicatorSeries2 = null; // for MACD signal / BB lower

let allData          = [];
let activeRangeHours = 120;
let lastSlice        = [];
let globalPredicted  = 0;
let globalConfidence = 70;

// Stock names mapping (for display)
const BANK_NAMES = {
"RELIANCE.NS":"Reliance Industries",
"TCS.NS":"TCS",
"INFY.NS":"Infosys",
"HDFCBANK.NS":"HDFC Bank",
"ICICIBANK.NS":"ICICI Bank",
"SBIN.NS":"State Bank of India",
"AXISBANK.NS":"Axis Bank",
"KOTAKBANK.NS":"Kotak Mahindra Bank",
"LT.NS":"Larsen & Toubro",
"HCLTECH.NS":"HCL Tech",
"ITC.NS":"ITC",
"WIPRO.NS":"Wipro",
"MARUTI.NS":"Maruti Suzuki",
"BAJFINANCE.NS":"Bajaj Finance",
"BAJAJFINSV.NS":"Bajaj Finserv",
"ADANIENT.NS":"Adani Enterprises",
"ADANIPORTS.NS":"Adani Ports",
"ONGC.NS":"ONGC",
"COALINDIA.NS":"Coal India",
"NTPC.NS":"NTPC",
"POWERGRID.NS":"Power Grid",
"ULTRACEMCO.NS":"UltraTech Cement",
"JSWSTEEL.NS":"JSW Steel",
"TATASTEEL.NS":"Tata Steel",
"HINDALCO.NS":"Hindalco",
"GRASIM.NS":"Grasim",
"ASIANPAINT.NS":"Asian Paints",
"PIDILITIND.NS":"Pidilite",
"NESTLEIND.NS":"Nestle India",
"BRITANNIA.NS":"Britannia",
"TITAN.NS":"Titan",
"SUNPHARMA.NS":"Sun Pharma",
"DRREDDY.NS":"Dr Reddy's",
"CIPLA.NS":"Cipla",
"DIVISLAB.NS":"Divis Labs",
"APOLLOHOSP.NS":"Apollo Hospitals",
"TECHM.NS":"Tech Mahindra",
"LTIM.NS":"LTIMindtree",
"MPHASIS.NS":"Mphasis",
"PERSISTENT.NS":"Persistent Systems",
"DLF.NS":"DLF",
"GODREJPROP.NS":"Godrej Properties",
"TATAPOWER.NS":"Tata Motors",
"EICHERMOT.NS":"Eicher Motors",
"HEROMOTOCO.NS":"Hero MotoCorp",
"M&M.NS":"Mahindra & Mahindra",
"BHARTIARTL.NS":"Bharti Airtel",
"INDUSINDBK.NS":"IndusInd Bank",
"HDFCLIFE.NS":"HDFC Life",
"SBILIFE.NS":"SBI Life"
};

// Dropdown now directly contains the symbol
function symbolFromBank(symbol) {
    return symbol;
}

function formatINR(n) {
    if (!n || n === 'null') return '—';
    return '₹' + Number(n).toLocaleString('en-IN',
        {minimumFractionDigits:2, maximumFractionDigits:2});
}

function filterByRange(data, hours) {

    if (!data.length) return data;

    const latest = new Date(data[data.length - 1].time).getTime();

    const cutoff = latest - hours * 3600 * 1000;

    return data.filter(d => {
        return new Date(d.time).getTime() >= cutoff;
    });

}
function safeRemove(s) {
    if (s) { try { chart.removeSeries(s); } catch(e){} }
    return null;
}

function clearAllSeries() {
    candleSeries     = safeRemove(candleSeries);
    actualLineSeries = safeRemove(actualLineSeries);
    predictedLine    = safeRemove(predictedLine);
    volumeSeries     = safeRemove(volumeSeries);
    indicatorSeries  = safeRemove(indicatorSeries);
    indicatorSeries2 = safeRemove(indicatorSeries2);
}

// ── Prediction ────────────────────────────────────────────────────────────────
function buildPredictedFromActual(data) {

    if (!data.length) return [];

    const last = data[data.length - 1];

    const step = data.length > 1
        ? data[data.length-1].time - data[data.length-2].time
        : 300;

    const result = [];

    for (let i = 0; i < data.length; i++) {
        result.push({
            time: data[i].time,
            value: data[i].close
        });
    }

    // Extend prediction using backend predicted price
    result.push({
        time: last.time + step,
        value: globalPredicted
    });

    return result;
}

// ── Render chart ──────────────────────────────────────────────────────────────
function renderChart(data) {
    if (!data.length) return;
    lastSlice = data;
    clearAllSeries();

    const type = chartTypeSelect.value;

    // Volume — always at bottom
    volumeSeries = chart.addHistogramSeries({
        priceFormat:  { type: 'volume' },
        priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
    volumeSeries.setData(data.map(d => ({
        time:  d.time,
        value: d.volume,
        color: d.close > d.open ? '#26a69a40' : '#ef535040',
    })));

    if (type === 'candle') {
        candleSeries = chart.addCandlestickSeries({
            upColor:'#26a69a', downColor:'#ef5350',
            borderUpColor:'#26a69a', borderDownColor:'#ef5350',
            wickUpColor:'#26a69a', wickDownColor:'#ef5350',
        });
        candleSeries.setData(data.map(d => ({
            time:d.time, open:d.open, high:d.high, low:d.low, close:d.close,
        })));
    } else {
        // Blue actual line
        actualLineSeries = chart.addLineSeries({color:'#00d0ff', lineWidth:2, title:'Actual'});
        actualLineSeries.setData(data.map(d => ({time:d.time, value:d.close})));

        // Green predicted line
        const predData = buildPredictedFromActual(data);
        if (predData.length > 0) {
            predictedLine = chart.addLineSeries({color:'#aae825', lineWidth:2, lineStyle:0, title:'Predicted'});
            predictedLine.setData(predData);
        }
    }

    renderIndicator(data);
}

// ── Render indicator ──────────────────────────────────────────────────────────
function renderIndicator(data) {
    indicatorSeries  = safeRemove(indicatorSeries);
    indicatorSeries2 = safeRemove(indicatorSeries2);

    const ind = indicatorSelect.value;

    if (ind === 'sma') {
        indicatorSeries = chart.addLineSeries({color:'#ffdd00', lineWidth:1, title:'SMA 20'});
        indicatorSeries.setData(
            data.filter(d => d.sma && d.sma !== 'null' && !isNaN(d.sma))
                .map(d => ({time:d.time, value:+d.sma}))
        );
    }
    else if (ind === 'ema') {
        indicatorSeries = chart.addLineSeries({color:'#ff9500', lineWidth:1, title:'EMA 9'});
        indicatorSeries.setData(
            data.filter(d => d.ema9 && d.ema9 !== 'null' && !isNaN(d.ema9))
                .map(d => ({time:d.time, value:+d.ema9}))
        );
    }
    else if (ind === 'rsi') {
        indicatorSeries = chart.addLineSeries({color:'#ff6b35', lineWidth:1, title:'RSI 14'});
        indicatorSeries.setData(
            data.filter(d => d.rsi && d.rsi !== 'null' && !isNaN(d.rsi))
                .map(d => ({time:d.time, value:+d.rsi}))
        );
    }
    else if (ind === 'macd') {
        // MACD line — blue
        indicatorSeries = chart.addLineSeries({color:'#00d0ff', lineWidth:1, title:'MACD'});
        indicatorSeries.setData(
            data.filter(d => d.macd && d.macd !== 'null' && !isNaN(d.macd))
                .map(d => ({time:d.time, value:+d.macd}))
        );
        // Signal line — orange
        indicatorSeries2 = chart.addLineSeries({color:'#ff9500', lineWidth:1, title:'Signal'});
        indicatorSeries2.setData(
            data.filter(d => d.macd_s && d.macd_s !== 'null' && !isNaN(d.macd_s))
                .map(d => ({time:d.time, value:+d.macd_s}))
        );
    }
    else if (ind === 'bb') {
        // Upper band — red
        indicatorSeries = chart.addLineSeries({color:'#ef5350', lineWidth:1, lineStyle:2, title:'BB Upper'});
        indicatorSeries.setData(
            data.filter(d => d.bb_u && d.bb_u !== 'null' && !isNaN(d.bb_u))
                .map(d => ({time:d.time, value:+d.bb_u}))
        );
        // Lower band — green
        indicatorSeries2 = chart.addLineSeries({color:'#26a69a', lineWidth:1, lineStyle:2, title:'BB Lower'});
        indicatorSeries2.setData(
            data.filter(d => d.bb_l && d.bb_l !== 'null' && !isNaN(d.bb_l))
                .map(d => ({time:d.time, value:+d.bb_l}))
        );
    }
}

// ── Update sidebar live indicators ────────────────────────────────────────────
function updateLiveIndicators(data) {
    if (!data.length) return;
    const last = data[data.length - 1];
    if (elRSI)  elRSI.textContent  = last.rsi   && last.rsi  !== 'null' ? (+last.rsi).toFixed(2)  : '—';
    if (elMACD) elMACD.textContent = last.macd   && last.macd !== 'null' ? (+last.macd).toFixed(4) : '—';
    if (elEMA)  elEMA.textContent  = last.ema9   && last.ema9 !== 'null' ? formatINR(last.ema9)    : '—';
    if (elBBU)  elBBU.textContent  = last.bb_u   && last.bb_u !== 'null' ? formatINR(last.bb_u)    : '—';
    if (elBBL)  elBBL.textContent  = last.bb_l   && last.bb_l !== 'null' ? formatINR(last.bb_l)    : '—';
}

// ── Fetch data ────────────────────────────────────────────────────────────────
async function loadChart() {
    const symbol = symbolFromBank(bankSelect.value);
    stockNameEl.textContent = BANK_NAMES[symbol] || symbol;
    stockPriceEl.textContent  = 'Loading…';
    stockChangeEl.textContent = '';

    try {
        const res  = await fetch(`http://127.0.0.1:5000/chart?symbol=${symbol}&interval=5m`);
        const json = await res.json();
        if (!json.data) { stockPriceEl.textContent = 'Error'; return; }

        allData = json.data.map(d => ({
            time:   new Date(d.time).getTime() / 1000,
            open:+d.open, high:+d.high, low:+d.low, close:+d.close,
            volume:+d.volume,
            sma:   d.SMA,    ema9:  d.EMA9,
            rsi:   d.RSI,    macd:  d.MACD,
            macd_s:d.MACD_S, macd_h:d.MACD_H,
            bb_u:  d.BB_U,   bb_l:  d.BB_L,  bb_m: d.BB_M,
        }));

        buildPredictedFromActual(allData);

        const slice = filterByRange(allData, activeRangeHours);
        renderChart(slice);
        updateLiveIndicators(slice);

        const latest    = json.latest_price;
        const prev      = allData.length > 1 ? allData[allData.length-2].close : latest;
        const changePct = ((latest - prev) / prev * 100).toFixed(2);
        const isPos     = changePct >= 0;

        stockPriceEl.textContent = formatINR(allData[allData.length-1].close);
        stockChangeEl.textContent = (isPos ? '+' : '') + changePct + '%';
        stockChangeEl.className   = 'change ' + (isPos ? 'positive' : 'negative');
        globalPredicted = json.predicted_price;
        predPriceEl.textContent   = formatINR(json.predicted_price);
        actPriceEl.textContent    = formatINR(latest);
        confidenceEl.textContent  = json.confidence + '%';
        if (accuracyEl) accuracyEl.textContent = json.accuracy + "%";
        // Trade signal values
        directionEl.textContent = json.direction || "—";
        entryEl.textContent = formatINR(json.entry);
        slEl.textContent = formatINR(json.stop_loss);
        targetEl.textContent = formatINR(json.target);

    } catch(err) {
        console.error('Fetch failed:', err);
        stockPriceEl.textContent = 'Offline';
    }
}

// ── Events ────────────────────────────────────────────────────────────────────
bankSelect.addEventListener('change', loadChart);
chartTypeSelect.addEventListener('change', () => { if (lastSlice.length) renderChart(lastSlice); });
indicatorSelect.addEventListener('change', () => { if (lastSlice.length) renderIndicator(lastSlice); });

document.querySelectorAll('.time-btn').forEach(btn => {

    btn.addEventListener('click', () => {

        document.querySelectorAll('.time-btn')
        .forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        activeRangeHours = parseInt(btn.dataset.range);

        const slice = filterByRange(allData, activeRangeHours);

        renderChart(slice);
        updateLiveIndicators(slice);

    });

});

document.getElementById('simulate').addEventListener('click', async () => {
    const btn = document.getElementById('simulate');
    btn.textContent = 'Analyzing…'; btn.disabled = true;
    try {
        const res  = await fetch('http://127.0.0.1:5000/analyze', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({symbol: symbolFromBank(bankSelect.value), interval:'5m'}),
        });
        const json = await res.json();
        alert(json.error
            ? 'Analysis error: ' + json.error
            : '📊 QuantAgent Decision\n\n' + (json.decision||'') +
              '\n\n--- Indicators ---\n' + (json.indicator_report||'') +
              '\n\n--- Pattern ---\n'    + (json.pattern_report||'') +
              '\n\n--- Trend ---\n'      + (json.trend_report||''));
    } catch(err) { alert('Backend offline: ' + err.message); }
    finally { btn.textContent = 'Simulate update'; btn.disabled = false; }
});

document.getElementById('refresh').addEventListener('click', loadChart);

setInterval(()=>{
    if(activeRangeHours === 6) return;
    loadChart();
},15000);
loadChart();