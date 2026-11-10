import React, { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CirclePlus, CreditCard, Ellipsis, Home, Search, SlidersHorizontal, Wallet, X } from "lucide-react";

type Entry = {
  id: number;
  name: string;
  detail: string;
  amount: number;
  day: number;
  kind: "income" | "expense" | "bill";
  icon: typeof Home;
  status?: "pending" | "paid";
};

const initialEntries: Entry[] = [
  { id: 1, name: "Studio salary", detail: "Namaa Creative · 09:14", amount: 8400, day: 18, kind: "income", icon: ArrowDownLeft },
  { id: 2, name: "Juniper Market", detail: "Groceries · 12:32", amount: -186.5, day: 18, kind: "expense", icon: Wallet },
  { id: 3, name: "Rent", detail: "Home · due 20 Jun", amount: -2400, day: 20, kind: "bill", icon: Home, status: "pending" },
  { id: 4, name: "Car installment", detail: "Auto · due 24 Jun", amount: -840, day: 24, kind: "bill", icon: CreditCard, status: "pending" },
  { id: 5, name: "Fiber internet", detail: "Utilities · due 27 Jun", amount: -249, day: 27, kind: "bill", icon: SlidersHorizontal, status: "pending" },
  { id: 6, name: "Mosaic Studio", detail: "Freelance invoice · 30 Jun", amount: 1250, day: 30, kind: "income", icon: ArrowDownLeft },
];

const formatMoney = (amount: number) =>
  Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 });

export default function LedgerFlow() {
  const [range, setRange] = useState("Month");
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeNav, setActiveNav] = useState("Flow");
  const [notice, setNotice] = useState("");
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formKind, setFormKind] = useState<"income" | "expense">("expense");

  const visibleEntries = useMemo(() => entries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())), [entries, query]);
  const selectedEntry = entries.find((entry) => entry.id === selected);
  const togglePaid = (id: number) => setEntries((all) => all.map((item) => item.id === id ? { ...item, status: item.status === "paid" ? "pending" : "paid" } : item));

  const addEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(formAmount);
    if (!formName.trim() || !amount || !Number.isFinite(amount)) return;
    setEntries((all) => [{ id: Date.now(), name: formName.trim(), detail: "Added just now · Today", amount: formKind === "income" ? amount : -amount, day: 18, kind: formKind, icon: formKind === "income" ? ArrowDownLeft : Wallet }, ...all]);
    setFormName("");
    setFormAmount("");
    setModal(false);
    setNotice("Transaction added to your flow");
    window.setTimeout(() => setNotice(""), 2600);
  };

  return (
    <main className="flow-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
        .flow-app{--ink:#20342f;--muted:#78847d;--line:#e5e9e1;--paper:#f8f8f2;--jade:#527b68;--lime:#d8ee8a;--coral:#d98265;min-height:100dvh;background:var(--paper);color:var(--ink);font-family:'Manrope',sans-serif;position:relative;overflow:hidden;padding:27px 22px 94px;box-sizing:border-box}
        .flow-app *{box-sizing:border-box}.flow-app button{font:inherit;color:inherit;cursor:pointer;border:0}
        .flow-top{display:flex;align-items:center;justify-content:space-between}.flow-brand{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:800;letter-spacing:.19em}.flow-brand-mark{width:23px;height:23px;border-radius:8px 8px 8px 3px;background:var(--jade);display:grid;place-items:center;color:var(--lime);font-size:14px}
        .flow-actions{display:flex;gap:8px}.flow-icon-btn{width:35px;height:35px;border:1px solid var(--line)!important;border-radius:50%;display:grid;place-items:center;background:#fff9}
        .flow-intro{margin-top:29px;display:flex;justify-content:space-between;align-items:flex-start}.flow-overline{font:10px 'DM Mono',monospace;letter-spacing:.12em;color:var(--muted);text-transform:uppercase}.flow-intro h1{margin:8px 0 0;font-size:27px;line-height:1.1;letter-spacing:-1.3px;font-weight:700}.flow-intro h1 em{font-family:Georgia,serif;font-weight:400;color:var(--jade)}
        .flow-date{margin-top:9px;font:10px 'DM Mono',monospace;color:var(--muted);display:flex;align-items:center;gap:6px}.flow-avatar{width:38px;height:38px;border-radius:14px;background:#e5ebe1;color:#486250;font-weight:800}
        .flow-account{margin-top:23px;padding:17px 18px 15px;background:#21473c;color:#f5f1df;border-radius:15px;position:relative;overflow:hidden}
        .flow-account:after{content:'';position:absolute;width:145px;height:145px;border:1px solid #ffffff19;border-radius:50%;right:-51px;top:-85px;box-shadow:0 0 0 19px #ffffff09,0 0 0 39px #ffffff06}
        .flow-account-label{color:#c0d2c3;font:9px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;display:flex;align-items:center;gap:7px}.flow-account-label i{width:6px;height:6px;border-radius:50%;background:var(--lime)}
        .flow-total{font-size:31px;letter-spacing:-1.2px;font-weight:700;margin-top:9px;position:relative;z-index:1}.flow-total small{font:11px 'DM Mono',monospace;color:#cfdbcc;letter-spacing:0;margin-right:5px}
        .flow-account-foot{display:flex;gap:21px;margin-top:11px;font-size:10px;color:#c4d1c6}.flow-account-foot span{display:flex;align-items:center;gap:5px}.flow-account-foot strong{color:#fff;font-weight:600}
        .flow-chart{margin:15px 0 2px;height:33px;width:100%;opacity:.95}
        .flow-section-head{display:flex;align-items:center;justify-content:space-between;margin:24px 0 13px}.flow-section-head h2{font-size:16px;letter-spacing:-.45px;margin:4px 0 0}.flow-range{display:flex;padding:3px;border-radius:9px;background:#ecefe8;gap:1px}.flow-range button{font-size:9px;color:#79847d;background:transparent;padding:6px 8px;border-radius:7px}.flow-range button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px #26392e14}
        .flow-summary{display:flex;align-items:stretch;border:1px solid var(--line);background:#fff9;border-radius:12px;overflow:hidden}.flow-summary-item{padding:10px 12px;flex:1}.flow-summary-item+.flow-summary-item{border-left:1px solid var(--line)}.flow-summary-item label{font:9px 'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.flow-summary-item strong{display:block;margin-top:5px;font-size:13px;letter-spacing:-.3px}.flow-summary-item .up{color:#527b68}.flow-summary-item .down{color:#bf745a}
        .flow-ledger-head{display:flex;align-items:center;justify-content:space-between;margin:22px 0 9px}.flow-ledger-head h2{font-size:16px;letter-spacing:-.5px;margin:4px 0 0}.flow-search{display:flex;align-items:center;gap:6px}.flow-search input{width:97px;border:0;background:transparent;outline:0;color:var(--ink);font-size:10px}.flow-search input::placeholder{color:#87918b}
        .flow-day-label{display:flex;align-items:center;gap:9px;margin:13px 0 7px;color:var(--muted);font:9px 'DM Mono',monospace;text-transform:uppercase;letter-spacing:.1em}.flow-day-label:after{content:'';height:1px;background:var(--line);flex:1}
        .flow-entry{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:10px 1px;border-bottom:1px solid #e9ece5;cursor:pointer}.flow-entry.selected{background:#eef1e9;margin:0 -8px;padding:10px 9px;border-radius:9px;border-color:transparent}.flow-entry-icon{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;background:#e8eee8;color:#537260}.flow-entry-icon.expense{background:#f3e9dd;color:#b47b58}.flow-entry-icon.bill{background:#e8e9dd;color:#787d56}.flow-entry-copy b{display:block;font-size:11px;font-weight:700}.flow-entry-copy span{display:block;margin-top:3px;font-size:9px;color:var(--muted)}.flow-entry-amount{text-align:right;font:11px 'DM Mono',monospace;white-space:nowrap}.flow-entry-amount.income{color:#55775f}.flow-entry-amount.bill{color:#48554b}.flow-entry-amount small{display:block;color:#9a8a6a;font:8px 'Manrope',sans-serif;margin-top:4px}
        .flow-due-action{padding:4px 7px;border-radius:6px;background:#ecf0e5;color:#62704e;font-size:8px!important;margin-top:4px}.flow-due-action.done{background:#dcece0;color:#47715a}
        .flow-detail{margin:3px 0 7px 44px;padding:10px 11px;border-left:2px solid #9aaa80;background:#eff1e9;border-radius:0 9px 9px 0;font-size:10px;display:flex;align-items:center;justify-content:space-between}.flow-detail button{background:transparent;display:flex;align-items:center;gap:5px;color:#58745e;font-size:9px}
        .flow-note{margin-top:17px;padding:13px 14px;background:#e8eee4;border-radius:11px;display:flex;gap:10px;align-items:flex-start}.flow-note-mark{font:17px Georgia;color:#66836c}.flow-note b{font-size:10px}.flow-note p{font-size:9px;color:#66776b;line-height:1.5;margin:4px 0 0}
        .flow-nav{position:fixed;z-index:5;bottom:0;left:0;right:0;height:72px;background:#fafaf6ee;border-top:1px solid var(--line);display:flex;justify-content:space-around;align-items:center;padding:0 18px 8px;backdrop-filter:blur(12px)}.flow-nav button{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:8px;color:#909992;background:transparent;min-width:45px}.flow-nav button.active{color:#3f6b56}.flow-nav .nav-plus{width:43px;height:43px;border-radius:15px;background:var(--jade);color:#f5f3e8;display:grid;place-items:center;margin-top:-20px;box-shadow:0 5px 13px #405c4933}
        .flow-toast{position:fixed;z-index:8;bottom:84px;left:50%;transform:translateX(-50%);background:#294d40;color:#f7f5e9;border-radius:20px;padding:10px 15px;font-size:10px;white-space:nowrap}
        .flow-modal-backdrop{position:fixed;inset:0;z-index:10;background:#18292170;display:flex;align-items:flex-end;justify-content:center}.flow-modal{width:100%;max-width:430px;background:var(--paper);border-radius:20px 20px 0 0;padding:21px 23px 28px}.flow-modal-top{display:flex;justify-content:space-between;align-items:center}.flow-modal h2{font-size:19px;margin:0;letter-spacing:-.6px}.flow-modal-close{width:30px;height:30px;border-radius:50%;background:#e9ece5;display:grid;place-items:center}.flow-kind{display:flex;background:#e9ede6;padding:3px;border-radius:9px;margin:19px 0 15px}.flow-kind button{flex:1;border-radius:7px;padding:9px;background:transparent;color:#728078;font-size:11px}.flow-kind button.on{background:#fff;color:var(--ink)}.flow-form label{display:block;font-size:10px;color:#65746b;margin:12px 0 6px}.flow-form input{width:100%;border:1px solid var(--line);background:#fff;border-radius:9px;padding:12px;font:13px 'Manrope',sans-serif;outline-color:#86a78f}.flow-submit{width:100%;margin-top:18px;padding:12px;border-radius:9px;background:#24493d;color:#fff!important;font-size:12px;font-weight:700}
        @media(min-width:600px){.flow-app{max-width:450px;margin:auto;border-left:1px solid #e8e9e2;border-right:1px solid #e8e9e2}.flow-nav{left:50%;right:auto;width:450px;transform:translateX(-50%)}}
      `}</style>

      <div className="flow-top">
        <div className="flow-brand"><span className="flow-brand-mark">f</span> FINCH</div>
        <div className="flow-actions">
          <button className="flow-icon-btn" aria-label="Search transactions" onClick={() => setShowSearch((open) => !open)}><Search size={15} /></button>
          <button className="flow-icon-btn" aria-label="Notifications" onClick={() => { setNotice("You’re all caught up"); window.setTimeout(() => setNotice(""), 2300); }}><Bell size={15} /></button>
        </div>
      </div>

      <header className="flow-intro">
        <div><div className="flow-overline">TUESDAY · 18 JUNE</div><h1>Your money,<br /><em>in motion.</em></h1><div className="flow-date"><CalendarDays size={12} /> June cashflow <ChevronDown size={12} /></div></div>
        <button className="flow-avatar" onClick={() => { setNotice("Account settings"); window.setTimeout(() => setNotice(""), 2300); }}>S</button>
      </header>

      <section className="flow-account">
        <div className="flow-account-label"><i /> AVAILABLE BALANCE <Ellipsis size={15} style={{ marginLeft: "auto" }} /></div>
        <div className="flow-total"><small>SAR</small>24,680</div>
        <div className="flow-account-foot"><span><ArrowDownLeft size={12} /> In <strong>8,400</strong></span><span><ArrowUpRight size={12} /> Out <strong>3,760</strong></span><span>↗ <strong>4.8%</strong></span></div>
        <svg className="flow-chart" viewBox="0 0 340 35" preserveAspectRatio="none" aria-label="Balance trend"><path d="M0 27 C20 24 24 29 40 21 S65 23 78 15 102 21 120 13 143 18 158 11 178 16 196 8 219 15 237 9 259 14 276 6 299 12 318 4 332 9 340 3" fill="none" stroke="#c9e28d" strokeWidth="1.7"/><path d="M0 27 C20 24 24 29 40 21 S65 23 78 15 102 21 120 13 143 18 158 11 178 16 196 8 219 15 237 9 259 14 276 6 299 12 318 4 332 9 340 3 V35 H0Z" fill="url(#fade)" opacity=".22"/><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d8ee8a"/><stop offset="1" stopColor="#d8ee8a" stopOpacity="0"/></linearGradient></defs></svg>
      </section>

      <section>
        <div className="flow-section-head"><div><div className="flow-overline">THE MONTH AT A GLANCE</div><h2>Cashflow</h2></div><div className="flow-range">{["Week", "Month", "Year"].map((item) => <button key={item} className={range === item ? "on" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></div>
        <div className="flow-summary">
          <div className="flow-summary-item"><label>Received</label><strong className="up">+ 9,650</strong></div>
          <div className="flow-summary-item"><label>Spent</label><strong className="down">− 3,760</strong></div>
          <div className="flow-summary-item"><label>To come</label><strong>− 3,489</strong></div>
        </div>
      </section>

      <section>
        <div className="flow-ledger-head"><div><div className="flow-overline">YOUR FINANCIAL TIMELINE</div><h2>Coming into focus</h2></div>
          {showSearch ? <div className="flow-search"><Search size={13} /><input aria-label="Filter timeline" autoFocus placeholder="Find a transaction" value={query} onChange={(event) => setQuery(event.target.value)} /><button aria-label="Close search" onClick={() => { setShowSearch(false); setQuery(""); }}><X size={13} /></button></div> : <button className="flow-icon-btn" aria-label="Search timeline" onClick={() => setShowSearch(true)}><Search size={14} /></button>}
        </div>
        <div className="flow-day-label">Today · 18 Jun</div>
        {visibleEntries.filter((item) => item.day === 18).map((entry) => {
          const Icon = entry.icon;
          return <React.Fragment key={entry.id}><div className={`flow-entry ${selected === entry.id ? "selected" : ""}`} onClick={() => setSelected(selected === entry.id ? null : entry.id)}><span className={`flow-entry-icon ${entry.kind}`}><Icon size={15} /></span><span className="flow-entry-copy"><b>{entry.name}</b><span>{entry.detail}</span></span><span className={`flow-entry-amount ${entry.kind}`}>{entry.amount > 0 ? "+" : "−"} {formatMoney(entry.amount)}</span></div>{selected === entry.id && <div className="flow-detail"><span>Account · Finch everyday</span><button onClick={() => { setNotice("Transaction details opened"); window.setTimeout(() => setNotice(""), 2200); }}>Details <ChevronRight size={12} /></button></div>}</React.Fragment>;
        })}
        <div className="flow-day-label">Next · 20–30 Jun</div>
        {visibleEntries.filter((item) => item.day > 18).map((entry) => {
          const Icon = entry.icon;
          return <React.Fragment key={entry.id}><div className={`flow-entry ${selected === entry.id ? "selected" : ""}`} onClick={() => setSelected(selected === entry.id ? null : entry.id)}><span className={`flow-entry-icon ${entry.kind}`}><Icon size={15} /></span><span className="flow-entry-copy"><b>{entry.name}</b><span>{entry.detail}</span></span><span className={`flow-entry-amount ${entry.kind}`}>{entry.amount > 0 ? "+" : "−"} {formatMoney(entry.amount)}{entry.kind === "bill" && <button className={`flow-due-action ${entry.status === "paid" ? "done" : ""}`} onClick={(event) => { event.stopPropagation(); togglePaid(entry.id); }}>{entry.status === "paid" ? <><Check size={9} /> Paid</> : "Mark paid"}</button>}</span></div>{selected === entry.id && <div className="flow-detail"><span>{entry.kind === "bill" ? "Scheduled payment · Finch everyday" : "Expected income · June"}</span><button onClick={() => { setNotice("Payment details opened"); window.setTimeout(() => setNotice(""), 2200); }}>Details <ChevronRight size={12} /></button></div>}</React.Fragment>;
        })}
        {visibleEntries.length === 0 && <div className="flow-note"><span className="flow-note-mark">↳</span><div><b>No matches in this stretch.</b><p>Try another name or clear your search to see your whole timeline.</p></div></div>}
      </section>

      <aside className="flow-note"><span className="flow-note-mark">✳</span><div><b>Your month has room to breathe.</b><p>After upcoming bills, SAR 21,191 remains available. A little more than this time last month.</p></div></aside>

      <nav className="flow-nav" aria-label="Main navigation">
        {[[Wallet, "Flow"], [SlidersHorizontal, "Plan"]].map(([Icon, label]) => { const NavIcon = Icon as typeof Wallet; return <button key={label as string} className={activeNav === label ? "active" : ""} onClick={() => { setActiveNav(label as string); setNotice(`${label} view selected`); window.setTimeout(() => setNotice(""), 1900); }}><NavIcon size={18} /><span>{label as string}</span></button>; })}
        <button className="nav-plus" aria-label="Add transaction" onClick={() => setModal(true)}><CirclePlus size={22} /></button>
        {[[ArrowUpRight, "Insights"], [CreditCard, "Cards"]].map(([Icon, label]) => { const NavIcon = Icon as typeof Wallet; return <button key={label as string} className={activeNav === label ? "active" : ""} onClick={() => { setActiveNav(label as string); setNotice(`${label} view selected`); window.setTimeout(() => setNotice(""), 1900); }}><NavIcon size={18} /><span>{label as string}</span></button>; })}
      </nav>

      {notice && <div className="flow-toast" role="status">{notice}</div>}
      {modal && <div className="flow-modal-backdrop" onClick={() => setModal(false)}><section className="flow-modal" onClick={(event) => event.stopPropagation()}><div className="flow-modal-top"><h2>Add to your flow</h2><button className="flow-modal-close" aria-label="Close dialog" onClick={() => setModal(false)}><X size={15} /></button></div><form className="flow-form" onSubmit={addEntry}><div className="flow-kind"><button type="button" className={formKind === "expense" ? "on" : ""} onClick={() => setFormKind("expense")}>Money out</button><button type="button" className={formKind === "income" ? "on" : ""} onClick={() => setFormKind("income")}>Money in</button></div><label htmlFor="flow-name">What was it?</label><input id="flow-name" value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="e.g. Lunch with friends" required /><label htmlFor="flow-amount">Amount · SAR</label><input id="flow-amount" type="number" min="0.01" step="0.01" value={formAmount} onChange={(event) => setFormAmount(event.target.value)} placeholder="0.00" required /><button type="submit" className="flow-submit">Add transaction</button></form></section></div>}
    </main>
  );
}
