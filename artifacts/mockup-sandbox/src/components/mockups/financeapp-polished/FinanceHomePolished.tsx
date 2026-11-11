import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  House,
  Landmark,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";

const payments = [
  { id: "rent", name: "Home rent", detail: "Due today · 1 Jun", amount: 2000, icon: House, tone: "teal", paid: true },
  { id: "netflix", name: "Netflix", detail: "Due 5 Jun", amount: 55, icon: CreditCard, tone: "rose", paid: false },
  { id: "internet", name: "STC Internet", detail: "Due 10 Jun", amount: 180, icon: Wifi, tone: "sky", paid: true },
  { id: "electricity", name: "Electricity", detail: "Due 12 Jun", amount: 280, icon: Zap, tone: "amber", paid: false },
];

const navItems = [
  { label: "Home", icon: House },
  { label: "Expenses", icon: CreditCard },
  { label: "Add", icon: Plus },
  { label: "Wallets", icon: Wallet },
  { label: "More", icon: MoreHorizontal },
];

export function FinanceHomePolished() {
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState("Home");
  const pending = payments.filter((payment) => !(paid[payment.id] ?? payment.paid === true)).length;

  return (
    <main className="fhp">
      <style>{`
        .fhp {
          --paper:#f3f6f8; --surface:#ffffff; --ink:#142c3a; --muted:#758894;
          --line:#e4ebee; --blue:#176b83; --blue-deep:#123f55; --mint:#d9eee8;
          --green:#26836d; --amber:#a87525; --serif: Georgia, 'Times New Roman', serif;
          min-height:100dvh; background:var(--paper); color:var(--ink);
          font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
          font-size:14px; -webkit-font-smoothing:antialiased;
        }
        .fhp * { box-sizing:border-box; }
        .fhp-scroll { width:100%; max-width:480px; min-height:100dvh; margin:0 auto; padding-bottom:92px; overflow:hidden; }
        .fhp-top { padding:20px 22px 0; }
        .fhp-brandline { display:flex; align-items:center; justify-content:space-between; margin-bottom:25px; }
        .fhp-brand { display:flex; align-items:center; gap:9px; color:var(--blue-deep); font-size:15px; font-weight:750; letter-spacing:-.35px; }
        .fhp-mark { display:grid; width:31px; height:31px; place-items:center; border-radius:10px; background:#dcece9; color:var(--blue); }
        .fhp-icon-button { width:38px; height:38px; display:grid; place-items:center; border:1px solid var(--line); border-radius:50%; color:var(--ink); background:#ffffff8c; cursor:pointer; }
        .fhp-greeting { margin-bottom:19px; animation:fhp-in .45s ease-out both; }
        .fhp-date { display:flex; align-items:center; gap:6px; color:var(--muted); font-size:11px; font-weight:650; letter-spacing:.65px; text-transform:uppercase; }
        .fhp-greeting h1 { margin:7px 0 3px; font:500 26px/1.12 var(--serif); letter-spacing:-.7px; color:var(--ink); }
        .fhp-greeting p { margin:0; color:var(--muted); font-size:13px; }
        .fhp-hero { position:relative; overflow:hidden; padding:20px 20px 17px; border-radius:22px; color:#eff7f6; background:linear-gradient(140deg,#17485d 0%,#176b83 100%); box-shadow:0 12px 26px #17485d20; animation:fhp-in .5s .04s ease-out both; }
        .fhp-hero:before { content:""; position:absolute; width:220px; height:220px; right:-86px; top:-130px; border:1px solid #ffffff1c; border-radius:50%; box-shadow:0 0 0 22px #ffffff08,0 0 0 46px #ffffff06; pointer-events:none; }
        .fhp-hero-label { position:relative; display:flex; align-items:center; gap:7px; color:#c5dadd; font-size:11px; font-weight:650; letter-spacing:1px; text-transform:uppercase; }
        .fhp-eye { display:grid; place-items:center; padding:3px; margin-left:1px; border:0; color:#c5dadd; background:transparent; cursor:pointer; }
        .fhp-total { position:relative; margin-top:8px; font-size:34px; line-height:1.06; font-weight:650; letter-spacing:-1.5px; font-variant-numeric:tabular-nums; }
        .fhp-total small { margin-left:5px; font-size:12px; font-weight:550; letter-spacing:0; color:#c2d9dc; }
        .fhp-change { display:inline-flex; align-items:center; gap:5px; margin-top:9px; padding:5px 8px; border-radius:20px; color:#d4f1e4; background:#ffffff16; font-size:11px; font-weight:650; }
        .fhp-divider { height:1px; margin:17px 0 14px; background:#ffffff28; }
        .fhp-hero-stats { display:grid; grid-template-columns:1fr 1fr; gap:14px; position:relative; }
        .fhp-stat + .fhp-stat { border-left:1px solid #ffffff28; padding-left:16px; }
        .fhp-stat-label { display:flex; align-items:center; gap:6px; margin-bottom:5px; color:#bed4d8; font-size:11px; }
        .fhp-stat-value { font-size:15px; font-weight:650; font-variant-numeric:tabular-nums; letter-spacing:-.2px; }
        .fhp-content { padding:19px 18px 24px; }
        .fhp-budget { padding:17px 16px 14px; border:1px solid #e3ebe9; border-radius:18px; background:var(--surface); box-shadow:0 4px 14px #1b41500a; animation:fhp-in .5s .1s ease-out both; }
        .fhp-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .fhp-eyebrow { color:var(--muted); font-size:11px; font-weight:650; letter-spacing:.7px; text-transform:uppercase; }
        .fhp-budget-number { margin-top:5px; font-size:23px; line-height:1; font-weight:720; letter-spacing:-.8px; font-variant-numeric:tabular-nums; }
        .fhp-budget-number span { color:#96a5ab; font-size:13px; font-weight:500; letter-spacing:0; }
        .fhp-budget-state { display:flex; align-items:center; gap:5px; padding:6px 9px; border-radius:20px; color:#267a67; background:#e9f5f0; font-size:11px; font-weight:700; white-space:nowrap; }
        .fhp-progress { height:8px; margin-top:16px; overflow:hidden; border-radius:9px; background:#edf1ef; }
        .fhp-progress span { display:block; width:56%; height:100%; border-radius:inherit; background:#4b9b84; }
        .fhp-budget-meta { display:flex; justify-content:space-between; gap:8px; margin-top:8px; color:var(--muted); font-size:11px; }
        .fhp-callout { display:flex; align-items:center; gap:10px; margin:14px 0 23px; padding:11px 12px; border:1px solid #f0e5cb; border-radius:13px; color:#795f35; background:#fbf7ed; animation:fhp-in .5s .14s ease-out both; }
        .fhp-callout-icon { display:grid; width:29px; height:29px; flex:none; place-items:center; border-radius:9px; color:#98763c; background:#f1e5c8; }
        .fhp-callout-copy { flex:1; min-width:0; font-size:11px; line-height:1.4; }
        .fhp-callout-copy strong { display:block; margin-bottom:1px; font-size:12px; color:#604b2b; }
        .fhp-dismiss { display:grid; width:27px; height:27px; place-items:center; border:0; border-radius:7px; color:#907c59; background:transparent; cursor:pointer; }
        .fhp-section-heading { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:12px; }
        .fhp-section-heading h2 { margin:0; font:500 21px/1 var(--serif); letter-spacing:-.35px; }
        .fhp-section-heading small { color:var(--muted); font-size:11px; }
        .fhp-link { display:flex; align-items:center; gap:2px; padding:0; border:0; color:var(--blue); background:none; font-size:12px; font-weight:650; cursor:pointer; }
        .fhp-insight { display:flex; align-items:center; gap:11px; margin-bottom:21px; padding:13px 14px; border:1px solid #deebe7; border-radius:15px; background:#eef6f3; }
        .fhp-insight-icon { display:grid; width:35px; height:35px; flex:none; place-items:center; border-radius:11px; color:#277961; background:#d7ebe2; }
        .fhp-insight-copy { flex:1; }
        .fhp-insight-copy strong { display:block; margin-bottom:3px; color:#284e43; font-size:12px; }
        .fhp-insight-copy span { color:#668077; font-size:11px; }
        .fhp-insight-arrow { color:#6b9586; }
        .fhp-payment-list { overflow:hidden; border:1px solid var(--line); border-radius:16px; background:var(--surface); }
        .fhp-payment { display:flex; align-items:center; gap:10px; min-height:67px; padding:10px 11px; }
        .fhp-payment + .fhp-payment { border-top:1px solid #edf1f2; }
        .fhp-pay-icon { display:grid; width:37px; height:37px; flex:none; place-items:center; border-radius:12px; }
        .fhp-pay-icon.teal { color:#35816e; background:#e3f1eb; } .fhp-pay-icon.rose { color:#a95b65; background:#f8e9eb; }
        .fhp-pay-icon.sky { color:#4c8296; background:#e6f0f3; } .fhp-pay-icon.amber { color:#a77b37; background:#f6f0e2; }
        .fhp-payment-copy { flex:1; min-width:0; }
        .fhp-payment-name { overflow:hidden; color:var(--ink); font-size:12px; font-weight:680; text-overflow:ellipsis; white-space:nowrap; }
        .fhp-payment-detail { margin-top:4px; color:var(--muted); font-size:10px; }
        .fhp-payment-right { display:flex; align-items:flex-end; flex-direction:column; gap:5px; }
        .fhp-payment-amount { font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .fhp-paid { min-width:46px; padding:4px 7px; border:0; border-radius:9px; color:#286d5a; background:#e6f3ed; font-size:10px; font-weight:700; cursor:pointer; }
        .fhp-paid.due { color:#8b6a32; background:#f7f0df; }
        .fhp-emi { display:flex; align-items:center; gap:11px; margin-top:20px; padding:14px; border:1px solid var(--line); border-radius:16px; background:var(--surface); }
        .fhp-emi-symbol { display:grid; width:38px; height:38px; flex:none; place-items:center; border-radius:12px; color:#347b89; background:#e7f1f2; }
        .fhp-emi-copy { flex:1; }
        .fhp-emi-copy strong { display:block; font-size:12px; }
        .fhp-emi-copy small { display:block; margin-top:4px; color:var(--muted); font-size:10px; }
        .fhp-emi-total { text-align:right; font-size:12px; font-weight:700; }
        .fhp-emi-total small { display:block; margin-top:4px; color:var(--muted); font-size:10px; font-weight:500; }
        .fhp-nav { position:fixed; z-index:4; right:0; bottom:0; left:0; display:flex; justify-content:center; padding:8px 12px max(12px,env(safe-area-inset-bottom)); border-top:1px solid #e5ebed; background:#f9fbfbed; backdrop-filter:blur(16px); }
        .fhp-nav-inner { display:grid; width:min(100%,480px); grid-template-columns:repeat(5,1fr); }
        .fhp-nav button { display:flex; align-items:center; flex-direction:column; gap:4px; padding:5px 0 1px; border:0; color:#8999a1; background:transparent; font-size:9px; font-weight:600; cursor:pointer; }
        .fhp-nav button.active { color:var(--blue); }
        .fhp-nav button.active:before { content:""; position:absolute; width:27px; height:2px; margin-top:-9px; border-radius:2px; background:#408b88; }
        @keyframes fhp-in { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width:370px) {
          .fhp-top { padding-right:17px; padding-left:17px; } .fhp-content { padding-right:14px; padding-left:14px; }
          .fhp-total { font-size:30px; } .fhp-hero { padding:18px 16px 15px; }
        }
      `}</style>

      <div className="fhp-scroll">
        <header className="fhp-top">
          <div className="fhp-brandline">
            <div className="fhp-brand"><span className="fhp-mark"><Landmark size={17} strokeWidth={2.1} /></span>FinanceApp</div>
            <button className="fhp-icon-button" type="button" aria-label="Notifications" onClick={() => setNotice(true)}><Bell size={17} /></button>
          </div>
          <div className="fhp-greeting">
            <div className="fhp-date"><CalendarDays size={12} /> Saturday, 1 June</div>
            <h1>Good morning, Manzoor</h1>
            <p>A clear view of your money, all in one place.</p>
          </div>
          <section className="fhp-hero">
            <div className="fhp-hero-label">Total balance
              <button className="fhp-eye" aria-label={showBalance ? "Hide balance" : "Show balance"} onClick={() => setShowBalance(!showBalance)}>{showBalance ? <Eye size={14} /> : <EyeOff size={14} />}</button>
            </div>
            <div className="fhp-total">{showBalance ? "SAR 36,500" : "••••••"}<small>SAR</small></div>
            <div className="fhp-change"><TrendingUp size={13} /> 4.8% <span>from last month</span></div>
            <div className="fhp-divider" />
            <div className="fhp-hero-stats">
              <div className="fhp-stat"><div className="fhp-stat-label"><ArrowDownLeft size={13} /> Monthly income</div><div className="fhp-stat-value">{showBalance ? "SAR 18,000" : "••••••"}</div></div>
              <div className="fhp-stat"><div className="fhp-stat-label"><ArrowUpRight size={13} /> Monthly outflow</div><div className="fhp-stat-value">{showBalance ? "SAR 6,247" : "••••••"}</div></div>
            </div>
          </section>
        </header>

        <div className="fhp-content">
          <section className="fhp-budget">
            <div className="fhp-card-head">
              <div><div className="fhp-eyebrow">Monthly budget</div><div className="fhp-budget-number">SAR 6,247 <span>of SAR 7,500</span></div></div>
              <div className="fhp-budget-state"><ShieldCheck size={13} /> On track</div>
            </div>
            <div className="fhp-progress"><span style={{ width: "83%" }} /></div>
            <div className="fhp-budget-meta"><span>SAR 1,253 left to spend</span><span>83% used</span></div>
          </section>

          {notice && <div className="fhp-callout">
            <span className="fhp-callout-icon"><Sparkles size={15} /></span>
            <div className="fhp-callout-copy"><strong>A little room to save</strong>Your subscriptions add up to SAR 117 this month.</div>
            <button className="fhp-dismiss" aria-label="Dismiss insight" onClick={() => setNotice(false)}><X size={14} /></button>
          </div>}

          <div className="fhp-section-heading">
            <h2>Coming up</h2>
            <button className="fhp-link" type="button" onClick={() => setActiveTab("Expenses")}>All payments <ChevronRight size={14} /></button>
          </div>
          <div className="fhp-payment-list">
            {payments.map(({ id, name, detail, amount, icon: Icon, tone, paid: initiallyPaid }) => {
              const isPaid = paid[id] ?? initiallyPaid;
              return <div className="fhp-payment" key={id}>
                <span className={`fhp-pay-icon ${tone}`}><Icon size={17} /></span>
                <div className="fhp-payment-copy"><div className="fhp-payment-name">{name}</div><div className="fhp-payment-detail">{detail}</div></div>
                <div className="fhp-payment-right"><span className="fhp-payment-amount">SAR {amount.toLocaleString()}</span>
                  <button className={`fhp-paid ${isPaid ? "" : "due"}`} type="button" onClick={() => setPaid((current) => ({ ...current, [id]: !isPaid }))}>{isPaid ? <><Check size={10} /> Paid</> : "Mark paid"}</button>
                </div>
              </div>;
            })}
          </div>

          <div className="fhp-section-heading" style={{ marginTop: 23 }}>
            <h2>In progress</h2>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>{pending} payments pending</span>
          </div>
          <div className="fhp-insight">
            <span className="fhp-insight-icon"><TrendingUp size={17} /></span>
            <div className="fhp-insight-copy"><strong>You’ve saved 18% of your income</strong><span>That’s SAR 3,240 set aside this month.</span></div>
            <ChevronRight className="fhp-insight-arrow" size={16} />
          </div>

          <div className="fhp-emi">
            <span className="fhp-emi-symbol"><Wallet size={17} /></span>
            <div className="fhp-emi-copy"><strong>Car loan</strong><small>12 of 60 installments paid</small></div>
            <div className="fhp-emi-total">SAR 2,000<small>monthly</small></div>
          </div>
        </div>
      </div>

      <nav className="fhp-nav" aria-label="Main navigation"><div className="fhp-nav-inner">
        {navItems.map(({ label, icon: Icon }) => (
          <button key={label} className={activeTab === label ? "active" : ""} type="button" onClick={() => setActiveTab(label)}>
            <Icon size={18} strokeWidth={activeTab === label ? 2.2 : 1.8} /><span>{label}</span>
          </button>
        ))}
      </div></nav>
    </main>
  );
}
