import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { db } from "../../firebase";
import { DEFAULT_RATES, MACHINE_NAMES, TOTAL_STATIONS } from "../../config/stations";
import useRates, { RATES_DOC } from "../../hooks/useRates";
import useNavigatorSales, { NAVIGATOR_MACHINE } from "../../hooks/useNavigatorSales";

// Owner-only page: business dashboard + price control. Gated by its own
// password (VITE_OWNER_PASSWORD), separate from the shop manager's /admin.
const SESSION_KEY = "ownerAuth";

const RATE_FIELDS = [
  { group: "Stations — per hour", fields: [
    { key: "hourlySolo", label: "Solo (1 player)" },
    { key: "hourlyDouble", label: "Double (2 players)" },
  ] },
  { group: "Stations — 30 minutes (flat)", fields: [
    { key: "halfHourSolo", label: "Solo (1 player)" },
    { key: "halfHourDouble", label: "Double (2 players)" },
  ] },
  { group: "Simulator & walk-ins", fields: [
    { key: "singleRace", label: "Single race" },
    { key: "quickCash1", label: "Quick walk-in (button 1)" },
    { key: "quickCash2", label: "Quick walk-in (button 2)" },
  ] },
  { group: "Events", fields: [
    { key: "eventPerHour", label: "Birthday / event per hour" },
  ] },
];

const readAuth = () => {
  try { return sessionStorage.getItem(SESSION_KEY) === "true"; } catch { return false; }
};
const writeAuth = (v) => {
  try { v ? sessionStorage.setItem(SESSION_KEY, "true") : sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};

const rs = (n) => `Rs. ${Math.round(n).toLocaleString()}`;
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const card = { background: "#121212", border: "1px solid #222", borderRadius: "15px", padding: "20px", height: "100%" };
const inputStyle = { background: "#252525", color: "white", border: "1px solid #444" };

const OwnerLogin = ({ onUnlock }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="section" style={{ background: "#050505", minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <form
        className="box"
        style={{ width: "100%", maxWidth: "400px", margin: "auto", background: "#1a1a1a", border: "1px solid #333" }}
        onSubmit={(e) => {
          e.preventDefault();
          const ownerPassword = import.meta.env.VITE_OWNER_PASSWORD;
          if (ownerPassword && password === ownerPassword) onUnlock();
          else setError("Incorrect password.");
        }}
      >
        <div className="has-text-centered mb-5">
          <h1 className="title is-4 has-text-white">Owner Access</h1>
          <p className="subtitle is-7 has-text-grey">Dashboard &amp; price control</p>
        </div>
        {error && <div className="notification is-danger is-light py-2 is-size-7">{error}</div>}
        <input
          className="input mb-4"
          style={inputStyle}
          type="password"
          placeholder="Owner password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
        />
        <button className="button is-primary is-fullwidth has-text-weight-bold">Unlock</button>
      </form>
    </div>
  );
};

const Stat = ({ label, value, sub, color = "has-text-white" }) => (
  <div style={card}>
    <p className="heading has-text-grey">{label}</p>
    <p className={`title is-3 ${color} mb-2`}>{value}</p>
    {sub && <p className="is-size-7 has-text-grey-light">{sub}</p>}
  </div>
);

const OwnerPanel = () => {
  const [isOwner, setIsOwner] = useState(readAuth);
  const [sessions, setSessions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const rates = useRates();
  const navigatorSales = useNavigatorSales(isOwner);
  const [draft, setDraft] = useState(null); // null = not editing, mirrors live rates
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [discount, setDiscount] = useState({ bool: false, percentage: 0 });
  const [discountDraft, setDiscountDraft] = useState("");

  useEffect(() => {
    if (!isOwner) return;

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const all = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (Array.isArray(data.sessions)) data.sessions.forEach((s) => all.push(s));
      });
      // Same de-dupe as the Admin Panel's transaction list.
      const seen = new Set();
      setSessions(all.filter((s) => {
        const key = `${s.machine}_${s.startTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
      setLoading(false);
    });

    const unsubInv = onSnapshot(collection(db, "invoices"), (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const date = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        list.push({ amount: Number(data.amountPaid) || 0, date });
      });
      setInvoices(list);
    });

    const unsubDiscount = onSnapshot(doc(db, "settings", "discount"), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const pct = Number(data.percentage) || 0;
      setDiscount({ bool: !!data.bool, percentage: pct > 0 && pct <= 1 ? pct * 100 : pct });
    });

    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => { unsubUsers(); unsubInv(); unsubDiscount(); clearInterval(timer); };
  }, [isOwner]);

  const stats = useMemo(() => {
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(startToday); weekAgo.setDate(weekAgo.getDate() - 6);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const s = {
      today: 0, cashToday: 0, cardToday: 0, sessionsToday: 0, hoursToday: 0,
      week: 0, month: 0, lifetime: 0, sessionLifetime: 0, lifetimeHours: 0, membershipMonth: 0, liveNow: 0, navigatorLifetime: 0,
      byStation: Object.fromEntries(MACHINE_NAMES.map((m) => [m, 0])),
    };

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(startToday); d.setDate(d.getDate() - i);
      days.push({ key: dayKey(d), label: d.toLocaleDateString([], { day: "numeric", month: "short" }), revenue: 0 });
    }
    const dayIndex = Object.fromEntries(days.map((d, i) => [d.key, i]));
    const addToDay = (date, amount) => {
      const i = dayIndex[dayKey(date)];
      if (i !== undefined) days[i].revenue += amount;
    };

    sessions.forEach((x) => {
      const date = new Date(x.startTime);
      if (isNaN(date)) return;
      const amount = Number(x.amountPaid) || 0;
      const hours = Number(x.duration) || 0;

      s.lifetime += amount;
      s.sessionLifetime += amount;
      s.lifetimeHours += hours;
      if (date >= startToday) {
        s.today += amount;
        s.sessionsToday += 1;
        s.hoursToday += hours;
        if (x.method === "CASH") s.cashToday += amount;
        if (x.method === "CARD") s.cardToday += amount;
      }
      if (date >= weekAgo) s.week += amount;
      if (date >= startMonth) {
        s.month += amount;
        const station = x.machine === "Quick Cash" ? "Quick walk-in" : x.machine || "Other";
        s.byStation[station] = (s.byStation[station] || 0) + amount;
      }
      const end = date.getTime() + hours * 3600000;
      if (MACHINE_NAMES.includes(x.machine) && now >= date && now.getTime() < end) s.liveNow += 1;
      addToDay(date, amount);
    });

    invoices.forEach((inv) => {
      if (isNaN(inv.date)) return;
      s.lifetime += inv.amount;
      if (inv.date >= startToday) s.today += inv.amount;
      if (inv.date >= weekAgo) s.week += inv.amount;
      if (inv.date >= startMonth) { s.month += inv.amount; s.membershipMonth += inv.amount; }
      addToDay(inv.date, inv.amount);
    });

    // One-off Navigator event-stall takings (no cash/card split recorded).
    navigatorSales.forEach((x) => {
      const date = new Date(x.startTime);
      if (isNaN(date)) return;
      const amount = x.amountPaid;
      s.lifetime += amount;
      s.navigatorLifetime += amount;
      if (date >= startToday) s.today += amount;
      if (date >= weekAgo) s.week += amount;
      if (date >= startMonth) {
        s.month += amount;
        s.byStation[NAVIGATOR_MACHINE] = (s.byStation[NAVIGATOR_MACHINE] || 0) + amount;
      }
      addToDay(date, amount);
    });

    const stationRows = Object.entries(s.byStation)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    return { ...s, days, stationRows };
  }, [sessions, invoices, navigatorSales, now]);

  if (!isOwner) return <OwnerLogin onUnlock={() => { writeAuth(true); setIsOwner(true); }} />;

  const editing = draft ?? rates;
  const dirty = draft !== null && Object.keys(DEFAULT_RATES).some((k) => Number(draft[k]) !== rates[k]);
  const invalid = draft !== null && Object.keys(DEFAULT_RATES).some((k) => !(Number(draft[k]) > 0));

  const saveRates = async () => {
    if (!dirty || invalid) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const payload = Object.fromEntries(Object.keys(DEFAULT_RATES).map((k) => [k, Number(draft[k])]));
      await setDoc(doc(db, ...RATES_DOC), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      setDraft(null);
      setSaveMsg("Prices updated. The website and admin panel now use the new rates.");
    } catch (err) {
      console.error(err);
      setSaveMsg("Save failed. Check your connection and try again.");
    }
    setSaving(false);
  };

  const saveDiscount = async (bool, percentage) => {
    try {
      await setDoc(doc(db, "settings", "discount"), { bool, percentage }, { merge: true });
      setDiscountDraft("");
    } catch (err) {
      console.error(err);
      alert("Could not update discount.");
    }
  };

  const lock = () => { writeAuth(false); setIsOwner(false); };

  return (
    <section className="section" style={{ background: "#050505", minHeight: "100vh", color: "white", padding: "1.5rem 1rem" }}>
      <div className="container" style={{ maxWidth: "1100px" }}>
        <div className="level is-mobile mb-5">
          <div className="level-left">
            <div>
              <h1 className="title is-3 has-text-white mb-1">Owner Dashboard</h1>
              <p className="subtitle is-6 has-text-primary">ADOX Gaming Center</p>
            </div>
          </div>
          <div className="level-right">
            <button className="button is-dark is-small" onClick={lock}>🔒 Lock</button>
          </div>
        </div>

        {/* --- DASHBOARD --- */}
        {loading ? (
          <p className="has-text-grey mb-5">Loading figures…</p>
        ) : (
          <>
            <div className="columns is-multiline mb-2">
              <div className="column is-6-tablet is-3-desktop">
                <Stat label="Today" value={rs(stats.today)} color="has-text-success"
                  sub={`💵 ${rs(stats.cashToday)} · 💳 ${rs(stats.cardToday)}`} />
              </div>
              <div className="column is-6-tablet is-3-desktop">
                <Stat label="Last 7 days" value={rs(stats.week)} color="has-text-info"
                  sub={`Avg ${rs(stats.week / 7)} / day`} />
              </div>
              <div className="column is-6-tablet is-3-desktop">
                <Stat label="This month" value={rs(stats.month)}
                  sub={`Memberships: ${rs(stats.membershipMonth)}`} />
              </div>
              <div className="column is-6-tablet is-3-desktop">
                <Stat label="Lifetime" value={rs(stats.lifetime)}
                  sub={`${stats.lifetimeHours.toFixed(1)} hrs played${stats.navigatorLifetime > 0 ? ` · Navigator event: ${rs(stats.navigatorLifetime)}` : ""}`} />
              </div>
              <div className="column is-6-tablet is-4-desktop">
                <Stat label="Sessions today" value={stats.sessionsToday}
                  sub={`${stats.hoursToday.toFixed(1)} hrs booked`} />
              </div>
              <div className="column is-6-tablet is-4-desktop">
                <Stat label="Live right now" value={`${stats.liveNow} / ${TOTAL_STATIONS}`}
                  color={stats.liveNow > 0 ? "has-text-warning" : "has-text-white"} sub="Stations in use" />
              </div>
              <div className="column is-12-tablet is-4-desktop">
                <Stat label="Earned per played hour" color="has-text-primary"
                  value={stats.lifetimeHours > 0 ? rs(stats.sessionLifetime / stats.lifetimeHours) : "—"}
                  sub="Lifetime, sessions only" />
              </div>
            </div>

            <div className="columns">
              <div className="column is-8">
                <div style={card}>
                  <p className="heading has-text-grey mb-4">Revenue — last 14 days</p>
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={stats.days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#222" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 11 }} axisLine={{ stroke: "#333" }} tickLine={false} />
                        <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} width={48}
                          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <Tooltip cursor={{ fill: "#ffffff0d" }}
                          contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                          labelStyle={{ color: "#ccc" }} itemStyle={{ color: "#00d1b2" }}
                          formatter={(v) => [rs(v), "Revenue"]} />
                        <Bar dataKey="revenue" fill="#00d1b2" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="column is-4">
                <div style={card}>
                  <p className="heading has-text-grey mb-4">This month by station</p>
                  {stats.stationRows.map((row) => {
                    const max = stats.stationRows[0]?.revenue || 1;
                    return (
                      <div key={row.name} className="mb-3">
                        <div className="is-flex is-justify-content-space-between is-size-7 mb-1">
                          <span className="has-text-grey-light">{row.name}</span>
                          <span className="has-text-white">{rs(row.revenue)}</span>
                        </div>
                        <div style={{ background: "#222", borderRadius: 4, height: 6 }}>
                          <div style={{ width: `${(row.revenue / max) * 100}%`, background: "#00d1b2", height: 6, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* --- PRICE CONTROL --- */}
        <div className="box mt-5" style={{ background: "#0d0d0d", border: "1px solid #00d1b244", borderRadius: "20px" }}>
          <h2 className="title is-4 has-text-white mb-1">Prices</h2>
          <p className="is-size-7 has-text-grey mb-5">
            Changes apply instantly to the website price calculator and the manager's admin panel. Past sessions keep the price they were charged.
          </p>

          <div className="columns is-multiline">
            {RATE_FIELDS.map((group) => (
              <div key={group.group} className="column is-6">
                <p className="heading has-text-primary mb-3">{group.group}</p>
                {group.fields.map((f) => (
                  <div key={f.key} className="field is-flex is-align-items-center mb-3" style={{ gap: 12 }}>
                    <label className="is-size-7 has-text-grey-light" style={{ flex: 1 }}>{f.label}</label>
                    <div className="control has-icons-left" style={{ width: 150 }}>
                      <input
                        className="input is-small"
                        style={inputStyle}
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={editing[f.key]}
                        onChange={(e) => setDraft({ ...editing, [f.key]: e.target.value })}
                      />
                      <span className="icon is-small is-left has-text-grey is-size-7">Rs</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {invalid && <p className="is-size-7 has-text-danger mb-3">Every price must be a number above 0.</p>}
          {saveMsg && <p className={`is-size-7 mb-3 ${saveMsg.startsWith("Save failed") ? "has-text-danger" : "has-text-success"}`}>{saveMsg}</p>}

          <div className="buttons">
            <button className={`button is-primary has-text-weight-bold ${saving ? "is-loading" : ""}`}
              disabled={!dirty || invalid} onClick={saveRates}>
              Save prices
            </button>
            <button className="button is-dark" disabled={draft === null} onClick={() => { setDraft(null); setSaveMsg(""); }}>
              Undo changes
            </button>
          </div>
        </div>

        {/* --- PROMO DISCOUNT --- */}
        <div className="box mt-5" style={{ background: "#0d0d0d", border: "1px solid #333", borderRadius: "20px" }}>
          <div className="level is-mobile mb-3">
            <div className="level-left">
              <div>
                <h2 className="title is-5 has-text-white mb-1">Promo discount</h2>
                <p className="is-size-7 has-text-grey">
                  Applied to non-member station bookings at the counter. Members always get 50% off.
                </p>
              </div>
            </div>
            <div className="level-right">
              <span className={`tag ${discount.bool && discount.percentage > 0 ? "is-danger" : "is-dark"}`}>
                {discount.bool && discount.percentage > 0 ? `${Math.round(discount.percentage)}% ON` : "OFF"}
              </span>
            </div>
          </div>
          <div className="field has-addons">
            <div className="control">
              <input className="input is-small" style={{ ...inputStyle, width: 90 }} type="number" min="1" max="100"
                placeholder={String(Math.round(discount.percentage) || 10)}
                value={discountDraft} onChange={(e) => setDiscountDraft(e.target.value)} />
            </div>
            <div className="control"><span className="button is-small is-static">%</span></div>
            <div className="control">
              <button className="button is-small is-danger"
                onClick={() => {
                  const pct = Number(discountDraft || discount.percentage);
                  if (!(pct > 0 && pct <= 100)) return alert("Enter a discount between 1 and 100%.");
                  saveDiscount(true, pct);
                }}>
                Turn on
              </button>
            </div>
            <div className="control">
              <button className="button is-small is-dark" disabled={!discount.bool}
                onClick={() => saveDiscount(false, discount.percentage)}>
                Turn off
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OwnerPanel;
