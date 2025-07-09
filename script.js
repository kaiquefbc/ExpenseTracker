const categorySelect = document.getElementById('category');
const amountInput = document.getElementById('amount');
const balance = document.getElementById('balance');
const income = document.getElementById('income');
const expense = document.getElementById('expense');
const currencySelect = document.getElementById('currency');
const currencyLabel = document.getElementById('currency-label');
const typeSelect = document.getElementById('type');
const monthInput = document.getElementById('month');
const transactionListContainer = document.getElementById('transaction-list');
const chartCtx = document.getElementById('chart').getContext('2d');
const enableSaving = document.getElementById('enable-saving');
const savingOptions = document.getElementById('saving-options');
const savingValueInput = document.getElementById('saving-value');
const savingSymbol = document.getElementById('saving-symbol');
const applySavingBtn = document.getElementById('apply-saving');

const incomeCategories = ["Salary", "Rent", "Investment", "Other"];
const expenseCategories = ["Rent", "Restaurant", "Transport", "Groceries", "Leisure", "Clothes", "Health", "Education", "Family", "Personal", "Other"];

let exchangeRates = {};
let currentCurrency = 'USD';
let transactions = [];
let chart;
let savingPlan = null;

async function loadRates() {
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
  exchangeRates = (await res.json()).rates;
}

function getCurrencySymbol(c) {
  return { USD: '$', BRL: 'R$', HUF: 'Ft', EUR: '€' }[c] || '';
}

function convertToUSD(val) {
  return val / (exchangeRates[currentCurrency] || 1);
}

function convertFromUSD(val) {
  return val * (exchangeRates[currentCurrency] || 1);
}

function getSavingMode() {
  const checked = document.querySelector('input[name="saving-mode"]:checked');
  return checked ? checked.value : 'fixed';
}

typeSelect.addEventListener('change', () => {
  categorySelect.disabled = false;
  categorySelect.innerHTML = '';
  const arr = typeSelect.value === 'income' ? incomeCategories : expenseCategories;
  arr.forEach(c => categorySelect.appendChild(new Option(c, c)));
});

currencySelect.addEventListener('change', () => {
  currentCurrency = currencySelect.value;

  if (getSavingMode() === 'fixed') {
    savingSymbol.textContent = getCurrencySymbol(currentCurrency);
  } else {
    savingSymbol.textContent = '%';
  }

  refreshUI();
});

enableSaving.addEventListener('change', () => {
  savingOptions.classList.toggle('hidden', !enableSaving.checked);
  if (!enableSaving.checked) {
    savingPlan = null;
    refreshUI();
  }
});


// Update saving symbol on radio button change
document.querySelectorAll('input[name="saving-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    savingSymbol.textContent = getSavingMode() === 'fixed' ? getCurrencySymbol(currentCurrency) : '%';
  });
});

applySavingBtn.addEventListener('click', () => {
  const value = parseFloat(savingValueInput.value);
  if (isNaN(value) || value <= 0) return alert("Enter a valid saving value.");

  savingPlan = {
    mode: getSavingMode(), // 'fixed' or 'percent'
    value,
    currency: currentCurrency
  };

  refreshUI();
});

document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!typeSelect.value || !categorySelect.value || !amountInput.value || !monthInput.value) return;

  const amt = parseFloat(amountInput.value);
  const signed = typeSelect.value === 'expense' ? -Math.abs(amt) : +Math.abs(amt);

  await fetch('/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: categorySelect.value,
      amount: convertToUSD(signed),
      month: monthInput.value.slice(0, 7),
      type: typeSelect.value
    })
  });

  e.target.reset();
  categorySelect.innerHTML = '';
  const arr = typeSelect.value === 'income' ? incomeCategories : expenseCategories;
  arr.forEach(c => categorySelect.appendChild(new Option(c, c)));

  refreshUI();
});

async function fetchTransactions() {
  const res = await fetch('/transactions');
  return await res.json();
}

async function refreshUI() {
  transactions = await fetchTransactions();
  sortTransactionsByDate();
  updateCurrencyUI();
  renderTransactions();
  renderSidebar();
  renderChart();
}

function updateCurrencyUI() {
  currencySelect.value = currentCurrency;
}

function sortTransactionsByDate() {
  transactions.sort((a, b) => a.month.localeCompare(b.month));
}

function renderTransactions() {
  let tot = 0, inc = 0, expn = 0;

  transactions.forEach(tx => {
    tot += tx.amount;
    if (tx.amount > 0) inc += tx.amount;
    else expn += tx.amount;
  });

  const balanceValue = convertFromUSD(tot);
  balance.textContent = `${getCurrencySymbol(currentCurrency)}${balanceValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  balance.style.color = balanceValue >= 0 ? 'green' : 'red';
  income.textContent = `${getCurrencySymbol(currentCurrency)}${convertFromUSD(inc).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  expense.textContent = `${getCurrencySymbol(currentCurrency)}${convertFromUSD(Math.abs(expn)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const savingBalanceElem = document.getElementById('saving-balance');
  const savingBalanceSpan = savingBalanceElem.querySelector('span');

  if (savingPlan && savingPlan.value > 0) {
    let savedTotalUSD = 0;

    const grouped = {};
    transactions.forEach(tx => {
      if (!grouped[tx.month]) grouped[tx.month] = { income: 0, expense: 0 };
      if (tx.type === 'income') grouped[tx.month].income += tx.amount;
    });

    const months = Object.keys(grouped).sort();
    months.forEach(month => {
      const incomeUSD = grouped[month].income || 0;

      if (savingPlan.mode === 'fixed') {
        const rate = exchangeRates[savingPlan.currency] || 1;
        savedTotalUSD += savingPlan.value / rate;
      } else {
        savedTotalUSD += incomeUSD * (savingPlan.value / 100);
      }
    });

    const converted = convertFromUSD(savedTotalUSD);
    savingBalanceSpan.textContent = `${getCurrencySymbol(currentCurrency)}${converted.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    savingBalanceElem.classList.remove('hidden');
  } else {
    savingBalanceElem.classList.add('hidden');
  }
}

function renderSidebar() {
  const container = transactionListContainer;
  container.innerHTML = '';

  const grouped = {};
  transactions.forEach(tx => {
    if (!grouped[tx.month]) grouped[tx.month] = {};
    const capitalType = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
    if (!grouped[tx.month][capitalType]) grouped[tx.month][capitalType] = [];
    grouped[tx.month][capitalType].push(tx);
  });

  Object.keys(grouped).sort().forEach(month => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'month-group';

    const monthHeader = document.createElement('div');
    monthHeader.className = 'collapsible';
    monthHeader.classList.add('expandable');
    monthHeader.innerHTML = `<span class="arrow">▶</span> ${month}`;

    const typeContainer = document.createElement('div');
    typeContainer.className = 'type-container hidden';

    Object.keys(grouped[month]).forEach(type => {
      const typeDiv = document.createElement('div');
      typeDiv.className = 'type-group';

      const typeHeader = document.createElement('div');
      typeHeader.className = 'collapsible type-header';
      typeHeader.classList.add('expandable');
      typeHeader.innerHTML = `<span class="arrow">▶</span> ${type}`;

      typeHeader.addEventListener('click', () => {
        const isExpanded = typeHeader.classList.toggle('expanded');
        txList.style.display = isExpanded ? 'block' : 'none';
      });

      const txList = document.createElement('ul');
      txList.className = 'transaction-list hidden';

      grouped[month][type].forEach(tx => {
        const li = document.createElement('li');
        const value = convertFromUSD(Math.abs(tx.amount)).toLocaleString(undefined, { minimumFractionDigits: 2 });
        li.innerHTML = `${tx.text}: ${tx.amount < 0 ? '-' : '+'}${getCurrencySymbol(currentCurrency)}${value} <button onclick="deleteTx(${tx.id})">x</button>`;
        txList.appendChild(li);
      });

      typeDiv.appendChild(typeHeader);
      typeDiv.appendChild(txList);
      typeContainer.appendChild(typeDiv);
    });

    monthDiv.appendChild(monthHeader);
    monthDiv.appendChild(typeContainer);
    container.appendChild(monthDiv);

    monthHeader.addEventListener('click', () => {
        const isExpanded = monthHeader.classList.toggle('expanded');
        typeContainer.style.display = isExpanded ? 'block' : 'none';
      });
  });
}

function renderChart() {
  if (transactions.length === 0) {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }

  const byMonth = {};
  transactions.forEach(tx => {
    if (!byMonth[tx.month]) byMonth[tx.month] = { income: 0, expense: 0 };
    if (tx.type === 'income') {
      byMonth[tx.month].income += tx.amount;
    } else {
      byMonth[tx.month].expense += Math.abs(tx.amount);
    }
  });

  function getMonthRange(start, end) {
    const result = [];
    const startDate = new Date(start + '-01');
    const endDate = new Date(end + '-01');
    endDate.setMonth(endDate.getMonth() + 1);

    const current = new Date(startDate);
    while (current < endDate) {
      result.push(current.toISOString().slice(0, 7));
      current.setMonth(current.getMonth() + 1);
    }
    return result;
  }

  const monthsSet = new Set(transactions.map(tx => tx.month));
  const monthDates = [...monthsSet].map(m => new Date(m + '-01'));
  monthDates.sort((a, b) => a - b);

  const firstMonth = monthDates[0].toISOString().slice(0, 7);
  const lastMonth = monthDates[monthDates.length - 1].toISOString().slice(0, 7);
  const months = getMonthRange(firstMonth, lastMonth);

  months.forEach(m => {
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
  });

  const inc = months.map(m => convertFromUSD(byMonth[m].income));
  const expn = months.map(m => convertFromUSD(byMonth[m].expense));

  let cum = 0;
  const cumArr = months.map(m => {
    cum += byMonth[m].income - byMonth[m].expense;
    return convertFromUSD(cum);
  });

  let savingsLine = [];

  if (savingPlan && savingPlan.value > 0) {
    let cumulative = 0;

    months.forEach(month => {
      const incomeUSD = byMonth[month].income || 0;
      let targetUSD = 0;

      if (savingPlan.mode === 'fixed') {
        const rate = exchangeRates[savingPlan.currency] || 1;
        targetUSD = savingPlan.value / rate;
      } else {
        targetUSD = incomeUSD * (savingPlan.value / 100);
      }

      cumulative += targetUSD;
      savingsLine.push(convertFromUSD(cumulative));
    });
  }

  if (chart) chart.destroy();

  chart = new Chart(chartCtx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          data: inc
        },
        {
          label: 'Expense',
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          data: expn
        },
        {
          label: 'Balance',
          type: 'line',
          data: cumArr,
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: true
        },
        ...(savingsLine.length > 0
          ? [{
              label: 'Saving Target',
              type: 'line',
              data: savingsLine,
              borderColor: 'rgba(255, 206, 86, 1)',
              borderDash: [10, 5],
              fill: false,
              pointRadius: 0
            }]
          : [])
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value =>
              getCurrencySymbol(currentCurrency) +
              value.toLocaleString(undefined, { minimumFractionDigits: 2 })
          }
        }
      }
    }
  });
}

window.deleteTx = async function (id) {
  if (!confirm('Delete this transaction?')) return;
  await fetch(`/delete/${id}`, { method: 'DELETE' });
  refreshUI();
};

(async function init() {
  await loadRates();
  refreshUI();
})();