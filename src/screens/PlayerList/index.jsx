import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

const PlayersList = () => {
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for the users collection
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

  // Filter logic for search
  const filteredPlayers = players.filter(p => 
    p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone?.includes(searchTerm)
  );


  const exportAllPlayersToCSV = () => {
  if (players.length === 0) return alert("No players to export");

  // 1. Collect all unique keys from both player profiles and their nested sessions
  const playerProfileKeys = new Set();
  const sessionKeys = new Set();

  players.forEach(player => {
    // Get profile keys (excluding the nested sessions array)
    Object.keys(player).forEach(key => {
      if (key !== "sessions") playerProfileKeys.add(key);
    });
    // Get session keys from every session of every player
    if (player.sessions && Array.isArray(player.sessions)) {
      player.sessions.forEach(s => {
        Object.keys(s).forEach(k => sessionKeys.add(`session_${k}`));
      });
    }
  });

  const profileHeaders = Array.from(playerProfileKeys);
  const sessionHeaders = Array.from(sessionKeys);
  const headers = [...profileHeaders, ...sessionHeaders];

  // 2. Build Rows
  const rows = [headers.join(",")];

  players.forEach(player => {
    const sessions = (player.sessions && Array.isArray(player.sessions)) ? player.sessions : [null];

    sessions.forEach(session => {
      const rowData = headers.map(header => {
        let val;
        if (header.startsWith("session_")) {
          const actualKey = header.replace("session_", "");
          val = session ? session[actualKey] : "";
        } else {
          val = player[header];
        }

        if (val === null || val === undefined) return "";
        
        // Date Formatting
        if (typeof val === "string" && !isNaN(Date.parse(val)) && val.length > 10) {
          val = new Date(val).toLocaleString().replace(/,/g, "");
        }

        // CSV Escape
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      rows.push(rowData.join(","));
    });
  });

  // 3. Download
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Adox_Master_Player_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
  return (
    <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
      <div className="container">
        <div className="level">
          <div className="level">
  <div className="level-left">
    <h1 className="title has-text-white">Registered Players</h1>
  </div>
  <div className="level-right">
    <button 
      className="button is-primary is-small is-outlined mr-4" 
      onClick={exportAllPlayersToCSV}
      style={{ borderColor: "#00d1b2", color: "#00d1b2" }}
    >
      📥 Export Master Data (CSV)
    </button>
    <p className="has-text-grey">Total: {players.length}</p>
  </div>
</div>
          <div className="level-left">
            <h1 className="title has-text-white">Registered Players</h1>
          </div>
          <div className="level-right">
            <p className="has-text-grey">Total: {players.length}</p>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="box mb-5" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
          <div className="field">
            <p className="control has-icons-left">
              <input 
                className="input is-dark" 
                type="text" 
                placeholder="Search by name or phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="icon is-small is-left">🔍</span>
            </p>
          </div>
        </div>

        {/* PLAYERS TABLE */}
        <div className="box" style={{ background: "#1a1a1a", padding: "0", border: "1px solid #333", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table is-fullwidth is-dark" style={{ background: "transparent" }}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Age</th>
                  <th className="has-text-centered">Bonus Left</th>
                  <th className="has-text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="has-text-centered">Loading players...</td></tr>
                ) : filteredPlayers.map((player) => (
                  <tr key={player.id} style={{ borderBottom: "1px solid #222" }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ 
                          width: "32px", height: "32px", borderRadius: "50%", 
                          background: "#333", overflow: "hidden" 
                        }}>
                          <img src={player.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.id}`} alt="avatar" />
                        </div>
                        <span className="has-text-weight-bold">{player.fullName}</span>
                      </div>
                    </td>
                    <td className="is-size-7">{player.phone}</td>
                    <td className="is-size-7 has-text-grey">{player.email}</td>
                    <td className="is-size-7">{player.age}</td>
                    <td className="has-text-centered">
                      <span className={`tag ${player.rewardClaimed ? 'is-dark' : 'is-success'}`}>
                        {player.bonusMinutes || 0}m
                      </span>
                    </td>
                    <td className="has-text-right is-size-7">
                      {player.sessions?.length || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayersList;