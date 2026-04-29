import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

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
    const now = new Date();
    let startLimit = new Date(0);
    let endLimit = new Date(now.getTime() + 86400000);

    if (range === "today") startLimit = new Date(now.setHours(0, 0, 0, 0));
    else if (range === "week") startLimit = new Date(now.setDate(now.getDate() - 7));
    else if (range === "month") startLimit = new Date(now.setMonth(now.getMonth() - 1));
    else if (range === "custom" && startDate && endDate) {
      startLimit = new Date(startDate);
      startLimit.setHours(0, 0, 0, 0);
      endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
    }

    return players
      .filter(p => {
        // 1. Check the Joined Date (createdAt)
        const joinedDate = new Date(p.createdAt || p.signupDate);
        const matchesRange = range === "lifetime" ? true : (joinedDate >= startLimit && joinedDate <= endLimit);
        
        // 2. Search match
        const matchesSearch = p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone?.includes(searchTerm);
        
        return matchesSearch && matchesRange;
      })
      .map(p => ({
        ...p,
        // Calculate sessions within the same range for the table display
        filteredSessions: (p.sessions || []).filter(s => {
            const sTime = new Date(s.startTime);
            return sTime >= startLimit && sTime <= endLimit;
        })
      }));
  };

  const filteredPlayers = getFilteredPlayers();

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
    <div style={{ background: "#050505", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <form className="box" style={{ width: "380px", background: "#1a1a1a", border: "1px solid #333" }} 
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
    <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
      <div className="container">
        
        <div className="level mb-5">
          <div className="level-left">
            <div>
              <h1 className="title has-text-white mb-1">New Sign-ups</h1>
              <p className="is-size-7 has-text-primary">
                Showing {filteredPlayers.length} users who joined during: <strong>{range.toUpperCase()}</strong>
              </p>
            </div>
          </div>
          <div className="level-right">
            <div className="field is-grouped is-grouped-multiline">
              {range === "custom" && (
                <div className="control is-flex" style={{ gap: '5px' }}>
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
                    <option value="month">Joined Last 30 Days</option>
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
            <table className="table is-fullwidth is-dark" style={{ background: "transparent" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  <th>Joined Date</th>
                  <th>Player Name</th>
                  <th>Phone</th>
                  <th className="has-text-right">Visits in Period</th>
                  <th className="has-text-right">Total Lifetime Playtime</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="has-text-centered p-6">Loading...</td></tr>
                ) : filteredPlayers.length > 0 ? (
                  filteredPlayers.map((player) => (
                    <tr key={player.id} style={{ borderBottom: "1px solid #222" }}>
                      <td className="is-size-7 has-text-info">
                          {player.createdAt ? new Date(player.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td>
                        <div className="is-flex is-align-items-center" style={{ gap: "10px" }}>
                          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#333", overflow: "hidden" }}>
                            <img src={player.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.id}`} alt="avatar" />
                          </div>
                          <span className="has-text-weight-bold is-size-7">{player.fullName}</span>
                        </div>
                      </td>
                      <td className="is-size-7">{player.phone || "N/A"}</td>
                      <td className="has-text-right has-text-grey">
                        {player.filteredSessions.length}
                      </td>
                      <td className="has-text-right is-size-7 has-text-weight-bold">
                        {(player.sessions || []).reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0).toFixed(1)}h
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="has-text-centered p-6 has-text-grey">No new users joined during this period.</td></tr>
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