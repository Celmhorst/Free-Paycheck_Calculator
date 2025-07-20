const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;

const FEDERAL_TAX_BRACKETS = {
  single: [
    { limit: 11000, rate: 0.10 },
    { limit: 44725, rate: 0.12 },
    { limit: 95375, rate: 0.22 },
    { limit: 182100, rate: 0.24 }
  ],
  married_joint: [
    { limit: 22000, rate: 0.10 },
    { limit: 89450, rate: 0.12 },
    { limit: 190750, rate: 0.22 },
    { limit: 364200, rate: 0.24 }
  ],
  married_separate: [
    { limit: 11000, rate: 0.10 },
    { limit: 44725, rate: 0.12 },
    { limit: 95375, rate: 0.22 },
    { limit: 182100, rate: 0.24 }
  ],
  head_household: [
    { limit: 15700, rate: 0.10 },
    { limit: 59850, rate: 0.12 },
    { limit: 95350, rate: 0.22 },
    { limit: 182100, rate: 0.24 }
  ]
};

// More realistic state tax approximations (estimated per paycheck withholding)
const STATE_TAX_TABLE = {
  CA: 0.04,
  TX: 0.00,
  NY: 0.05,
  WI: 0.045,
  FL: 0.00,
  default: 0.045
};

document.addEventListener("DOMContentLoaded", () => {
  populateStates();
  toggleHoursField();
  loadSavedInputs();

  document.getElementById("payType").addEventListener("change", toggleHoursField);
  document.getElementById("paycheck-form").addEventListener("submit", handleSubmit);
});

function populateStates() {
  const stateSelect = document.getElementById("state");
  const states = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
    "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
    "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
    "WI","WY"
  ];
  states.forEach(state => {
    const opt = document.createElement("option");
    opt.value = state;
    opt.textContent = state;
    stateSelect.appendChild(opt);
  });
}

function toggleHoursField() {
  const payType = document.getElementById("payType").value;
  const hoursGroup = document.getElementById("hoursGroup");
  hoursGroup.style.display = payType === "hourly" ? "block" : "none";
}

function handleSubmit(e) {
  e.preventDefault();
  saveInputs();

  const income = parseFloat(document.getElementById("income").value);
  const payType = document.getElementById("payType").value;
  const frequency = document.getElementById("frequency").value;
  const filingStatus = document.getElementById("filingStatus").value;
  const dependents = parseInt(document.getElementById("dependents").value) || 0;
  const state = document.getElementById("state").value;
  const untaxableIncome = parseFloat(document.getElementById("untaxableIncome").value) || 0;
  const hours = payType === "hourly" ? parseFloat(document.getElementById("hours").value) || 0 : 0;

  const deductions = [
    "deduct401k", "deductHealth", "deductDental",
    "deductLife", "deductDisability", "deductOther"
  ].map(id => parseFloat(document.getElementById(id).value) || 0);
  const totalDeductions = deductions.reduce((sum, val) => sum + val, 0);

  const grossPay = calculateGrossPay(payType, frequency, income, hours);
  const annualGross = grossPay * getAnnualMultiplier(frequency);
  const federalTax = estimateFederalTax(annualGross, filingStatus, dependents, frequency);
  const stateTax = estimateStateTax(grossPay, state);
  const ssTax = grossPay * SS_RATE;
  const medicareTax = grossPay * MEDICARE_RATE;
  const disabilityTax = estimateDisabilityTax(state, grossPay);
  const netPay = grossPay - federalTax - stateTax - ssTax - medicareTax - disabilityTax - totalDeductions + untaxableIncome;

  document.getElementById("grossPay").textContent = formatCurrency(grossPay);
  document.getElementById("federalTax").textContent = formatCurrency(federalTax);
  document.getElementById("stateTax").textContent = formatCurrency(stateTax);
  document.getElementById("ssTax").textContent = formatCurrency(ssTax);
  document.getElementById("medicareTax").textContent = formatCurrency(medicareTax);
  document.getElementById("disabilityTax").textContent = formatCurrency(disabilityTax);
  document.getElementById("untaxable").textContent = formatCurrency(untaxableIncome);
  document.getElementById("netPay").textContent = formatCurrency(netPay);

  document.getElementById("results").classList.remove("hidden");
}

function calculateGrossPay(type, frequency, income, hours) {
  const multiplier = getAnnualMultiplier(frequency);
  return type === "hourly" ? (income * hours * 52) / multiplier : income / multiplier;
}

function getAnnualMultiplier(frequency) {
  return frequency === "weekly" ? 52 : frequency === "biweekly" ? 26 : 12;
}

function estimateFederalTax(annualIncome, status, dependents, frequency) {
  const STANDARD_DEDUCTIONS = {
    single: 14600,
    married_joint: 29200,
    married_separate: 14600,
    head_household: 21900
  };
  const DEP_CREDIT = 2000;
  const deduction = STANDARD_DEDUCTIONS[status] || 13000;
  const taxable = Math.max(annualIncome - deduction, 0);
  const brackets = FEDERAL_TAX_BRACKETS[status];
  let tax = 0, prev = 0;

  for (const b of brackets) {
    if (taxable > b.limit) {
      tax += (b.limit - prev) * b.rate;
      prev = b.limit;
    } else {
      tax += (taxable - prev) * b.rate;
      break;
    }
  }

  tax = Math.max(tax - dependents * DEP_CREDIT, 0);
  return tax / getAnnualMultiplier(frequency);
}

function estimateStateTax(gross, state) {
  const rate = STATE_TAX_TABLE[state] ?? STATE_TAX_TABLE.default;
  return gross * rate;
}

function estimateDisabilityTax(state, gross) {
  return state === "CA" ? gross * 0.009 : 0;
}

function formatCurrency(val) {
  return `$${val.toFixed(2)}`;
}

function saveInputs() {
  const fields = document.querySelectorAll("input, select");
  fields.forEach(field => {
    localStorage.setItem(field.id, field.value);
  });
}

function loadSavedInputs() {
  const fields = document.querySelectorAll("input, select");
  fields.forEach(field => {
    const saved = localStorage.getItem(field.id);
    if (saved !== null) field.value = saved;
  });
}
