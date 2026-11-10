import React, { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bell, Check, ChevronRight, CreditCard, Home, MoreHorizontal, PieChart, Plus, RefreshCw, Wallet } from "lucide-react";
import "./ledgerdashboard.css";

const bills = [
  { name: "Rent", detail: "Home · due 1st", amount: "SAR 2,400", icon: Home, tint: "blue" },
  { name: "Car installment", detail: "Auto · due 12th", amount: "SAR 840", icon: CreditCard, tint: "gold" },
  { name: "Internet", detail: "Utilities · due 18th", amount: "SAR 249", icon: PieChart, tint: "mint" },
];

const insights = [
  { title: "Food delivery", text: "SAR 900 potential savings", tone: "green" },
  { title: "Subscriptions", text: "SAR 117 this month", tone: "violet" },
  { title: "Spending pace", text: "18% above last month", tone: "orange" },
];

export default function LedgerDashboard() {
  const [paid, setPaid] = useState<string[]>([]);
  const [active, setActive] = useState("Overview");
  const [showAll, setShowAll] = useState(false);
  const balance = "24,680";
  const togglePaid = (name: string) => setPaid((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);

  return (
    <main className="ledger-screen">
      <div className="ledger-topline"><span className="ledger-mark"><span className="ledger-mark-dot" /> FINCH</span><button className="ledger-bell" aria-label="Notifications"><Bell size={18} /><i /></button></div>
      <header className="ledger-greeting">
        <div><span className="ledger-eyebrow">TUESDAY, 18 JUNE</span><h1>Good morning,<br /><em>Samira.</em></h1></div>
        <button className="ledger-avatar" aria-label="Account settings">S</button>
      </header>

      <section className="ledger-balance">
        <div className="balance-head"><span>YOUR TOTAL BALANCE</span><button aria-label="Balance options"><MoreHorizontal size={19} /></button></div>
        <div className="balance-amount"><small>SAR</small> {balance}</div>
        <div className="balance-foot"><span><i className="balance-up"><ArrowDownLeft size={13} /></i>Income <b>SAR 8,400</b></span><span><i className="balance-down"><ArrowUpRight size={13} /></i>Spent <b>SAR 3,760</b></span></div>
        <div className="balance-stamp">+ 4.8% <span>this month</span></div>
      </section>

      <section className="ledger-budget">
        <div className="budget-ring"><div><strong>62%</strong><small>used</small></div></div>
        <div className="budget-copy"><span className="ledger-eyebrow">MONTHLY BUDGET</span><h2>SAR 2,240 <small>left</small></h2><p>of SAR 6,000 · you're on track</p></div>
        <div className="budget-rule"><span /></div>
      </section>

      <section className="ledger-section">
        <div className="section-heading"><div><span className="ledger-eyebrow">COMING UP</span><h2>This month</h2></div><button onClick={() => setShowAll((value) => !value)}>{showAll ? "Less" : "See all"} <ChevronRight size={14} /></button></div>
        <div className="ledger-bills">
          {bills.slice(0, showAll ? 3 : 3).map(({ name, detail, amount, icon: Icon, tint }) => {
            const isPaid = paid.includes(name);
            return <div className={`bill-row ${isPaid ? "is-paid" : ""}`} key={name}>
              <div className={`bill-icon ${tint}`}><Icon size={17} /></div>
              <div className="bill-desc"><b>{name}</b><span>{detail}</span></div>
              <div className="bill-end"><b>{amount}</b><button onClick={() => togglePaid(name)} className={isPaid ? "paid-button done" : "paid-button"}>{isPaid ? <><Check size={11} /> Paid</> : "Mark paid"}</button></div>
            </div>;
          })}
        </div>
      </section>

      <section className="ledger-insights">
        <div className="section-heading insights-title"><div><span className="ledger-eyebrow">A LITTLE CLARITY</span><h2>Money notes</h2></div><span className="spark">✳</span></div>
        {insights.map((item, index) => <div className={`insight-row ${item.tone}`} key={item.title}><span className="insight-index">0{index + 1}</span><div><b>{item.title}</b><span>{item.text}</span></div><ChevronRight size={15} /></div>)}
      </section>

      <section className="ledger-emi"><div className="emi-icon"><RefreshCw size={17} /></div><div><span className="ledger-eyebrow">ACTIVE EMI</span><b>MacBook Pro</b><small>8 of 12 payments complete</small></div><strong>SAR 420<small>/mo</small></strong></section>

      <nav className="ledger-nav" aria-label="Main navigation">
        {[["Overview", Home], ["Activity", PieChart], ["Wallets", Wallet], ["More", MoreHorizontal]].map(([label, Icon]) => {
          const NavIcon = Icon as typeof Home;
          return <button className={active === label ? "selected" : ""} key={label as string} onClick={() => setActive(label as string)}><NavIcon size={19} /><span>{label as string}</span></button>;
        })}
      </nav>
      <button className="ledger-add" aria-label="Add transaction"><Plus size={22} /></button>
    </main>
  );
}
