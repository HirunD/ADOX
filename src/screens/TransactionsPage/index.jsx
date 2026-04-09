import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";

const TransactionsPage = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [transactions, setTransactions] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [filter, setFilter] = useState("all"); // today, week, month, all
    const [totalRevenue, setTotalRevenue] = useState(0);

    useEffect(() => {
        // 1. Listen to all users to get all sessions
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            let allSessions = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.sessions && Array.isArray(data.sessions)) {
                    data.sessions.forEach((s) => {
                        allSessions.push({
                            ...s,
                            userName: data.fullName,
                            userId: doc.id
                        });
                    });
                }
            });
            // Deduplicate by machine + startTime (shared sessions are saved to both users, we only want one billing entry)
            const seen = new Set();
            const unique = allSessions.filter((s) => {
                const key = `${s.machine}_${s.startTime}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // Sort by newest first
            const sorted = unique.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            setTransactions(sorted);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        filterData();
    }, [transactions, filter]);

    const filterData = () => {
        const now = new Date();
        const toLocalDate = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        let filtered = transactions.filter((t) => {
            const tDate = new Date(t.startTime);
            if (filter === "today") {
                return toLocalDate(tDate) === toLocalDate(now);
            } else if (filter === "week") {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(now.getDate() - 7);
                return tDate >= oneWeekAgo;
            } else if (filter === "month") {
                return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
            }
            return true; // "all"
        });

        setFilteredData(filtered);
        const total = filtered.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
        setTotalRevenue(total);
    };

    if (!isAdmin) return (
        <div style={{ background: "#050505", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <form style={{ width: "100%", maxWidth: "380px", background: "#1a1a1a", borderRadius: "12px", padding: "32px", border: "1px solid #333" }} onSubmit={(e) => {
                e.preventDefault(); if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
            }}>
                <h1 className="title has-text-white">Admin Login</h1>
                <input className="input is-dark mb-3" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="button is-primary is-fullwidth">Login</button>
            </form>
        </div>
    );


    const exportToCSV = () => {
    if (filteredData.length === 0) return alert("No data to export");

    // 1. Get all unique keys across all transactions to ensure no data is missed
    const allKeys = new Set();
    filteredData.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
    const headers = Array.from(allKeys);

    // 2. Build the CSV content
    const csvRows = [];
    
    // Add Header Row
    csvRows.push(headers.join(","));

    // Add Data Rows
    for (const row of filteredData) {
        const values = headers.map(header => {
            let val = row[header];
            
            // Handle null/undefined
            if (val === null || val === undefined) return "";

            // Format Dates for Excel/Sheets readability
            if (header.toLowerCase().includes("time") && !isNaN(Date.parse(val))) {
                val = new Date(val).toLocaleString().replace(/,/g, ""); 
            }

            // Clean strings to prevent CSV breaking (quotes and commas)
            const stringVal = String(val).replace(/"/g, '""');
            return `"${stringVal}"`;
        });
        csvRows.push(values.join(","));
    }

    // 3. Create blob and download
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Adox_Full_Report_${filter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

    return (
        <div style={{ background: "#080808", minHeight: "100vh", color: "white", padding: "16px" }}>
            <style>{`
                .txn-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
                .txn-filters { display: flex; gap: 8px; flex-wrap: wrap; }
                .txn-table-wrap { display: block; }
                .txn-cards { display: none; }
                @media (max-width: 768px) {
                    .txn-table-wrap { display: none; }
                    .txn-cards { display: block; }
                }
                .txn-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
                .txn-card-left { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
                .txn-card-right { text-align: right; flex-shrink: 0; }
                .txn-player { font-weight: 700; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
                .txn-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
                .txn-date { font-size: 0.72rem; color: #888; }
            `}</style>

            <div style={{ maxWidth: "900px", margin: "0 auto" }}>

                {/* HEADER */}
                <div className="txn-header">
                    <div>
                        <h1 className="title has-text-white mb-1" style={{ fontSize: "1.4rem" }}>Financial Overview</h1>
                        <p style={{ color: "#00d1b2", fontSize: "0.8rem" }}>Track your earnings and play history</p>
                    </div>
                    <div className="txn-filters">
                        <div className="txn-filters">
    {/* The New Export Button */}
    <button
        onClick={exportToCSV}
        style={{
            padding: "6px 14px", 
            borderRadius: "20px", 
            border: "1px solid #00d1b2", 
            cursor: "pointer", 
            fontSize: "0.8rem", 
            fontWeight: 600, 
            background: "transparent", 
            color: "#00d1b2",
            marginRight: "10px",
            transition: "0.2s"
        }}
        onMouseOver={(e) => e.target.style.background = "rgba(0, 209, 178, 0.1)"}
        onMouseOut={(e) => e.target.style.background = "transparent"}
    >
        📥 Export All Data
    </button>

    {["today", "week", "month", "all"].map((f) => (
        <button
            key={f}
            style={{
                padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, textTransform: "capitalize",
                background: filter === f ? "#00d1b2" : "#2a2a2a",
                color: filter === f ? "#000" : "#aaa"
            }}
            onClick={() => setFilter(f)}
        >
            {f}
        </button>
    ))}
</div>
                    
                    </div>
                </div>

                {/* REVENUE CARD */}
                <div style={{ background: "linear-gradient(135deg, #00d1b2 0%, #006b5a 100%)", borderRadius: "14px", padding: "20px 24px", marginBottom: "20px" }}>
                    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Total Revenue ({filter})
                    </p>
                    <h2 style={{ color: "white", fontSize: "2.2rem", fontWeight: 800, marginTop: "4px" }}>Rs. {totalRevenue.toLocaleString()}</h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", marginTop: "4px" }}>{filteredData.length} transaction{filteredData.length !== 1 ? "s" : ""}</p>
                </div>

                {/* DESKTOP TABLE */}
                <div className="txn-table-wrap" style={{ background: "#1a1a1a", borderRadius: "12px", border: "1px solid #2a2a2a", overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", background: "transparent" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #333" }}>
                                    {["Date", "Player", "Station", "Duration", "Method", "Amount"].map((h, i) => (
                                        <th key={h} style={{ padding: "12px 16px", color: "#666", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", textAlign: i === 5 ? "right" : "left" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length > 0 ? filteredData.map((t, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                                        <td style={{ padding: "12px 16px", fontSize: "0.8rem" }}>
                                            {new Date(t.startTime).toLocaleDateString()}<br />
                                            <span style={{ color: "#666" }}>{new Date(t.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                        </td>
                                        <td style={{ padding: "12px 16px", fontSize: "0.85rem", fontWeight: 600 }}>{t.players || t.userName}</td>
                                        <td style={{ padding: "12px 16px" }}><span style={{ background: "#0d3d35", color: "#00d1b2", border: "1px solid #00d1b2", borderRadius: "6px", padding: "2px 8px", fontSize: "0.75rem" }}>{t.machine}</span></td>
                                        <td style={{ padding: "12px 16px", fontSize: "0.85rem" }}>{t.duration}h</td>
                                        <td style={{ padding: "12px 16px" }}><span style={{ background: t.method === "CASH" ? "#1a3a25" : "#1a2a3a", color: t.method === "CASH" ? "#48c774" : "#3273dc", borderRadius: "6px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600 }}>{t.method}</span></td>
                                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>Rs. {t.amountPaid}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="6" style={{ padding: "40px", textAlign: "center", color: "#555" }}>No transactions found for this period.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* MOBILE CARDS */}
                <div className="txn-cards">
                    {filteredData.length > 0 ? filteredData.map((t, i) => (
                        <div key={i} className="txn-card">
                            <div className="txn-card-left">
                                <span className="txn-player">{t.players || t.userName}</span>
                                <div className="txn-meta">
                                    <span style={{ background: "#0d3d35", color: "#00d1b2", border: "1px solid #00d1b2", borderRadius: "5px", padding: "1px 7px", fontSize: "0.72rem" }}>{t.machine}</span>
                                    <span style={{ background: t.method === "CASH" ? "#1a3a25" : "#1a2a3a", color: t.method === "CASH" ? "#48c774" : "#3273dc", borderRadius: "5px", padding: "1px 7px", fontSize: "0.72rem", fontWeight: 600 }}>{t.method}</span>
                                    <span style={{ color: "#666", fontSize: "0.72rem" }}>{t.duration}h</span>
                                </div>
                                <span className="txn-date">{new Date(t.startTime).toLocaleDateString()} · {new Date(t.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className="txn-card-right">
                                <span style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>Rs. {t.amountPaid}</span>
                            </div>
                        </div>
                    )) : (
                        <p style={{ textAlign: "center", color: "#555", padding: "40px 0" }}>No transactions found for this period.</p>
                    )}
                </div>

            </div>
        </div>
    );
};

export default TransactionsPage;