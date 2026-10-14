import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { DEFAULT_PASSWORD } from "../../config/defaultPassword";
import { PERIOD_LABELS, getPeriodRange, isInRange } from "../../config/periods";

const PlayersList = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Range States
  const [range, setRange] = useState("lifetime");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("fullName", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playerList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlayers(playerList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- LOGIC: FILTER BY SIGN-UP DATE ---
  const getFilteredPlayers = () => {
    const dateRange = getPeriodRange(range, { startDate, endDate });

    return players
      .filter(p => {
        // 1. Check the Joined Date (createdAt)
        const joinedDate = new Date(p.createdAt || p.signupDate);
        const matchesRange = range === "lifetime" ? true : isInRange(joinedDate, dateRange);
        
        // 2. Search match
        const matchesSearch = p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone?.includes(searchTerm);
        
        return matchesSearch && matchesRange;
      })
      .map(p => ({
        ...p,
        // Calculate sessions within the same range for the table display
        filteredSessions: (p.sessions || []).filter(s => isInRange(s.startTime, dateRange))
      }));
  };

  const filteredPlayers = getFilteredPlayers();

  const [resettingId, setResettingId] = useState(null);

  const resetPassword = async (player) => {
    if (!window.confirm(`Reset ${player.fullName}'s password to "${DEFAULT_PASSWORD}"?\nThey'll be asked to set a new one when they next log in.`)) return;
    setResettingId(player.id);
    try {
      const res = await fetch("/.netlify/functions/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: player.id, adminKey: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reset failed");
      alert(`Password reset to "${DEFAULT_PASSWORD}"`);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setResettingId(null);
    }
  };

  const exportAllPlayersToCSV = () => {
    if (filteredPlayers.length === 0) return alert("No players in this range to export");
    
    const allProfileKeys = new Set();
    filteredPlayers.forEach(player => {
        Object.keys(player).forEach(key => {
            // Filter out internal objects
            if (key !== "sessions" && key !== "avatar" && key !== "id" && key !== "filteredSessions") {
                allProfileKeys.add(key);
            }
        });
    });

    const headers = Array.from(allProfileKeys);
    const finalHeaders = ["Joined_Date", ...headers, `Visits_in_Period`, "Total_Lifetime_Hours"];
    const rows = [finalHeaders.join(",")];

    filteredPlayers.forEach(player => {
        const rowData = finalHeaders.map(header => {
            let val;
            if (header === "Joined_Date") val = player.createdAt || player.signupDate || "N/A";
            else if (header === `Visits_in_Period`) val = player.filteredSessions.length;
            else if (header === "Total_Lifetime_Hours") val = (player.sessions || []).reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0).toFixed(2);
            else val = player[header];

            if (val === null || val === undefined) return "";
            if (typeof val === "string" && !isNaN(Date.parse(val)) && (val.includes("T") || val.includes("-"))) {
                val = new Date(val).toLocaleDateString().replace(/,/g, "");
            }
            return `"${String(val).replace(/"/g, '""')}"`;
        });
        rows.push(rowData.join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Adox_New_Signups_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdmin) return (
    <div style={{ background: "#050505", minHeight: "calc(100vh - var(--nav-height))", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <form className="box" style={{ width: "100%", maxWidth: "380px", background: "#1a1a1a", border: "1px solid #333" }}
          onSubmit={(e) => {
            e.preventDefault(); 
            if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
            else alert("Incorrect Password");
        }}>
            <h1 className="title has-text-white is-5">Database Access</h1>
            <input className="input is-dark mb-3" type="password" placeholder="Admin Key" onChange={(e) => setPassword(e.target.value)} autoFocus />
            <button className="button is-primary is-fullwidth">Unlock</button>
        </form>
    </div>
  );

  return (
    <div className="section px-4" style={{ background: "#050505", minHeight: "100vh" }}>
      <div className="container">
        
        <div className="level mb-5">
          <div className="level-left">
            <div>
              <h1 className="title has-text-white mb-1">New Sign-ups</h1>
              <p className="is-size-7 has-text-primary">
                Showing {filteredPlayers.length} users who joined during: <strong>{(PERIOD_LABELS[range === "lifetime" ? "all" : range]).toUpperCase()}</strong>
              </p>
            </div>
          </div>
          <div className="level-right">
            <div className="field is-grouped is-grouped-multiline">
              {range === "custom" && (
                <div className="control is-flex is-flex-wrap-wrap" style={{ gap: '5px' }}>
                  <input className="input is-small is-dark" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <input className="input is-small is-dark" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              )}
              <div className="control">
                <div className="select is-small is-dark">
                  <select value={range} onChange={(e) => setRange(e.target.value)}>
                    <option value="lifetime">All Time (Lifetime)</option>
                    <option value="today">Joined Today</option>
                    <option value="week">Joined Last 7 Days</option>
                    <option value="month">Joined This Month</option>
                    <option value="last30">Joined Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
              </div>
              <div className="control">
                <button className="button is-primary is-small is-outlined" onClick={exportAllPlayersToCSV}>📥 Export New Users</button>
              </div>
            </div>
          </div>
        </div>

        <div className="box mb-5" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
          <div className="field">
            <p className="control has-icons-left">
              <input className="input is-dark" type="text" placeholder="Search new sign-ups..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <span className="icon is-small is-left">🔍</span>
            </p>
          </div>
        </div>

        <div className="box" style={{ background: "#1a1a1a", padding: "0", border: "1px solid #333", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table is-fullwidth is-dark" style={{ background: "transparent", minWidth: "600px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  <th>Joined Date</th>
                  <th>Player Name</th>
                  <th>Phone</th>
                  <th className="has-text-right">Visits in Period</th>
                  <th className="has-text-right">Total Lifetime Playtime</th>
                  <th className="has-text-right">Password</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="has-text-centered p-6">Loading...</td></tr>
                ) : filteredPlayers.length > 0 ? (
                  filteredPlayers.map((player) => (
                    <tr key={player.id} style={{ borderBottom: "1px solid #222" }}>
                      <td className="is-size-7 has-text-info">
                          {player.createdAt ? new Date(player.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td>
                        <div className="is-flex is-align-items-center" style={{ gap: "10px" }}>
                          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#333", overflow: "hidden", flexShrink: 0 }}>
                            <img src={`/avatars/${player.avatar || "1.png"}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <span className="has-text-weight-bold is-size-7" style={{ whiteSpace: "nowrap" }}>{player.fullName}</span>
                        </div>
                      </td>
                      <td className="is-size-7">{player.phone || "N/A"}</td>
                      <td className="has-text-right has-text-grey">
                        {player.filteredSessions.length}
                      </td>
                      <td className="has-text-right is-size-7 has-text-weight-bold">
                        {(player.sessions || []).reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0).toFixed(1)}h
                      </td>
                      <td className="has-text-right">
                        {player.id !== "guest_walkin" && (
                          <button
                            className={`button is-small is-warning is-outlined ${resettingId === player.id ? "is-loading" : ""}`}
                            onClick={() => resetPassword(player)}
                            disabled={resettingId !== null}
                          >
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="has-text-centered p-6 has-text-grey">No new users joined during this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayersList;