import type { Account, EMI, Expense, Income, SavingsGoal } from "@/context/FinanceContext";

interface ReportData {
  userName: string;
  currency: string;
  monthlyBudget: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  totalEMIMonthly: number;
  remainingBudget: number;
  totalBalance: number;
  totalSavings: number;
  expenses: Expense[];
  emis: EMI[];
  accounts: Account[];
  incomes: Income[];
  savingsGoals: SavingsGoal[];
}

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function pct(val: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((val / total) * 100)}%`;
}

export function generateMonthlyReportHTML(data: ReportData): string {
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();
  const generatedAt = now.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  const savingsRate =
    data.totalMonthlyIncome > 0
      ? Math.max(0, ((data.totalMonthlyIncome - data.totalMonthlyExpenses - data.totalEMIMonthly) / data.totalMonthlyIncome) * 100)
      : 0;

  const byCategory: Record<string, number> = {};
  for (const exp of data.expenses) {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  }
  const sortedCategories = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const totalExpenseCat = Object.values(byCategory).reduce((s, v) => s + v, 0);

  const activeEMIs = data.emis.filter((e) => e.paidInstallments < e.totalInstallments);

  const expenseRows = data.expenses
    .slice()
    .sort((a, b) => a.dueDate - b.dueDate)
    .map(
      (e) => `
      <tr>
        <td>${e.name}</td>
        <td>${e.category}</td>
        <td style="text-align:right">${fmt(e.amount, data.currency)}</td>
        <td style="text-align:center">${e.dueDate}${["th","st","nd","rd"][Math.min(e.dueDate % 10 > 3 ? 0 : e.dueDate % 10, 3)]}</td>
        <td style="text-align:center">
          <span class="${e.isPaid ? "badge-paid" : "badge-due"}">${e.isPaid ? "Paid" : "Due"}</span>
        </td>
      </tr>`
    )
    .join("");

  const emiRows = activeEMIs
    .map(
      (e) => {
        const progress = Math.round((e.paidInstallments / e.totalInstallments) * 100);
        const remaining = e.totalInstallments - e.paidInstallments;
        const totalRemaining = remaining * e.monthlyAmount;
        return `
        <tr>
          <td>${e.name}</td>
          <td style="text-align:right">${fmt(e.monthlyAmount, data.currency)}/mo</td>
          <td style="text-align:center">${e.paidInstallments}/${e.totalInstallments}</td>
          <td style="text-align:center">${progress}%</td>
          <td style="text-align:right">${fmt(totalRemaining, data.currency)}</td>
        </tr>`;
      }
    )
    .join("");

  const goalRows = data.savingsGoals
    .map((g) => {
      const progress = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
      const remaining = Math.max(0, g.targetAmount - g.savedAmount);
      return `
      <tr>
        <td>${g.name}</td>
        <td style="text-align:right">${fmt(g.savedAmount, data.currency)}</td>
        <td style="text-align:right">${fmt(g.targetAmount, data.currency)}</td>
        <td style="text-align:center">${progress}%</td>
        <td style="text-align:right">${remaining > 0 ? fmt(remaining, data.currency) : "Complete"}</td>
      </tr>`;
    })
    .join("");

  const accountRows = data.accounts
    .map(
      (a) => `
      <tr>
        <td>${a.name}</td>
        <td style="text-align:center;text-transform:capitalize">${a.type}</td>
        <td style="text-align:right">${fmt(a.balance, data.currency)}</td>
      </tr>`
    )
    .join("");

  const categoryRows = sortedCategories
    .map(([cat, amount]) => {
      const p = Math.round((amount / totalExpenseCat) * 100);
      return `
      <tr>
        <td>${cat}</td>
        <td style="text-align:right">${fmt(amount, data.currency)}</td>
        <td style="text-align:center">${p}%</td>
        <td>
          <div style="background:#1A2A45;border-radius:3px;height:8px;overflow:hidden">
            <div style="width:${p}%;height:8px;border-radius:3px;background:#60A5FA"></div>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #F4F6FB;
      color: #0A0F1E;
      font-size: 13px;
      line-height: 1.5;
    }
    .page { max-width: 750px; margin: 0 auto; padding: 32px 24px 48px; }

    /* Header */
    .header {
      background: linear-gradient(135deg, #0B1E3D 0%, #0E2E5C 100%);
      border-radius: 16px;
      padding: 32px;
      color: #fff;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left .app-name {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.55);
      margin-bottom: 8px;
    }
    .header-left .report-title {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .header-left .report-sub {
      font-size: 13px;
      color: rgba(255,255,255,0.65);
    }
    .header-right { text-align: right; }
    .header-right .user-name {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .header-right .generated {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
    }

    /* Summary grid */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: #fff;
      border-radius: 12px;
      padding: 18px;
      border: 1px solid #DBEAFE;
    }
    .summary-card .label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 8px;
    }
    .summary-card .value {
      font-size: 20px;
      font-weight: 700;
      color: #0A0F1E;
    }
    .summary-card .value.green { color: #10B981; }
    .summary-card .value.red { color: #EF4444; }
    .summary-card .value.blue { color: #2563EB; }
    .summary-card .value.amber { color: #F59E0B; }

    /* Sections */
    .section {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #DBEAFE;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0A0F1E;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #EFF3FF;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 16px;
      background: linear-gradient(180deg, #2563EB, #60A5FA);
      border-radius: 2px;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    th {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748B;
      padding: 6px 8px;
      background: #F4F6FB;
      border-radius: 4px;
      text-align: left;
    }
    td {
      padding: 10px 8px;
      font-size: 13px;
      color: #0A0F1E;
      border-bottom: 1px solid #F0F3FB;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #F8FAFF; }

    /* Badges */
    .badge-paid {
      background: #D1FAE5;
      color: #065F46;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-due {
      background: #FEE2E2;
      color: #991B1B;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }

    /* Footer */
    .footer {
      text-align: center;
      color: #94A3B8;
      font-size: 11px;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #DBEAFE;
    }

    .net-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #EFF3FF;
    }
    .net-row:last-child { border-bottom: none; }
    .net-row .net-label { font-size: 13px; color: #64748B; }
    .net-row .net-value { font-size: 14px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="app-name">FinanceApp</div>
        <div class="report-title">${monthName} ${year}</div>
        <div class="report-sub">Monthly Financial Report</div>
      </div>
      <div class="header-right">
        <div class="user-name">${data.userName}</div>
        <div class="generated">Generated ${generatedAt}</div>
      </div>
    </div>

    <!-- Summary KPIs -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Total Income</div>
        <div class="value green">${fmt(data.totalMonthlyIncome, data.currency)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Spent</div>
        <div class="value red">${fmt(data.totalMonthlyExpenses + data.totalEMIMonthly, data.currency)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Net Savings</div>
        <div class="value ${data.remainingBudget >= 0 ? "blue" : "red"}">${fmt(data.remainingBudget, data.currency)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Monthly Budget</div>
        <div class="value">${fmt(data.monthlyBudget, data.currency)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Savings Rate</div>
        <div class="value blue">${savingsRate.toFixed(1)}%</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Balance</div>
        <div class="value">${fmt(data.totalBalance, data.currency)}</div>
      </div>
    </div>

    <!-- Cashflow summary -->
    <div class="section">
      <div class="section-title">Monthly Cashflow</div>
      <div class="net-row">
        <span class="net-label">Income</span>
        <span class="net-value" style="color:#10B981">+${fmt(data.totalMonthlyIncome, data.currency)}</span>
      </div>
      <div class="net-row">
        <span class="net-label">Recurring Expenses</span>
        <span class="net-value" style="color:#EF4444">-${fmt(data.totalMonthlyExpenses, data.currency)}</span>
      </div>
      <div class="net-row">
        <span class="net-label">EMI Payments</span>
        <span class="net-value" style="color:#F59E0B">-${fmt(data.totalEMIMonthly, data.currency)}</span>
      </div>
      <div class="net-row">
        <span class="net-label" style="font-weight:700;color:#0A0F1E">Net Available</span>
        <span class="net-value" style="color:${data.remainingBudget >= 0 ? "#2563EB" : "#EF4444"};font-size:16px">${fmt(data.remainingBudget, data.currency)}</span>
      </div>
    </div>

    <!-- Expense breakdown by category -->
    <div class="section">
      <div class="section-title">Expense Categories</div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th style="text-align:right">Amount</th>
            <th style="text-align:center">Share</th>
            <th style="width:120px">Breakdown</th>
          </tr>
        </thead>
        <tbody>${categoryRows}</tbody>
      </table>
    </div>

    <!-- Expenses table -->
    <div class="section">
      <div class="section-title">Recurring Expenses (${data.expenses.length})</div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th style="text-align:right">Amount</th>
            <th style="text-align:center">Due</th>
            <th style="text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>${expenseRows}</tbody>
      </table>
    </div>

    ${activeEMIs.length > 0 ? `
    <!-- EMI table -->
    <div class="section">
      <div class="section-title">Active EMIs (${activeEMIs.length})</div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th style="text-align:right">Monthly</th>
            <th style="text-align:center">Progress</th>
            <th style="text-align:center">Paid</th>
            <th style="text-align:right">Remaining Total</th>
          </tr>
        </thead>
        <tbody>${emiRows}</tbody>
      </table>
    </div>` : ""}

    ${data.savingsGoals.length > 0 ? `
    <!-- Savings Goals -->
    <div class="section">
      <div class="section-title">Savings Goals</div>
      <table>
        <thead>
          <tr>
            <th>Goal</th>
            <th style="text-align:right">Saved</th>
            <th style="text-align:right">Target</th>
            <th style="text-align:center">Progress</th>
            <th style="text-align:right">Still Needed</th>
          </tr>
        </thead>
        <tbody>${goalRows}</tbody>
      </table>
    </div>` : ""}

    <!-- Accounts -->
    <div class="section">
      <div class="section-title">Account Balances</div>
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th style="text-align:center">Type</th>
            <th style="text-align:right">Balance</th>
          </tr>
        </thead>
        <tbody>${accountRows}</tbody>
        <tr>
          <td colspan="2" style="font-weight:700;padding-top:12px">Total</td>
          <td style="text-align:right;font-weight:700;padding-top:12px;color:#2563EB">${fmt(data.totalBalance, data.currency)}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      FinanceApp · ${data.userName}'s Financial Report · ${monthName} ${year}<br/>
      This report was automatically generated and is for personal reference only.
    </div>

  </div>
</body>
</html>`;
}
