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
        <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
            <form className="box" style={{ maxWidth: "400px", margin: "100px auto", background: "#1a1a1a" }} onSubmit={(e) => {
                e.preventDefault(); if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
            }}>
                <h1 className="title has-text-white">Admin Login</h1>
                <input className="input is-dark mb-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="button is-primary is-fullwidth">Login</button>
            </form>
        </div>
    );

    return (
        <div className="section" style={{ background: "#080808", minHeight: "100vh", color: "white" }}>
            <div className="container">
                <div className="columns is-vcentered">
                    <div className="column">
                        <h1 className="title has-text-white mb-2">Financial Overview</h1>
                        <p className="subtitle is-6 has-text-primary">Track your earnings and play history</p>
                    </div>
                    <div className="column has-text-right">
                        <div className="buttons is-right">
                            {["today", "week", "month", "all"].map((f) => (
                                <button
                                    key={f}
                                    className={`button is-small is-rounded is-capitalize ${filter === f ? "is-primary" : "is-dark"}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* REVENUE CARD */}
                <div className="box" style={{ background: "linear-gradient(145deg, #00d1b2 0%, #006b5a 100%)", border: "none" }}>
                    <p className="is-size-7 is-uppercase has-text-weight-bold" style={{ color: "rgba(255,255,255,0.8)" }}>
                        Total Revenue ({filter})
                    </p>
                    <h2 className="title is-2 has-text-white">Rs. {totalRevenue.toLocaleString()}</h2>
                </div>

                {/* TRANSACTIONS TABLE */}
                <div className="box" style={{ background: "#1a1a1a", border: "1px solid #333", padding: "0" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table className="table is-fullwidth is-dark" style={{ background: "transparent" }}>
                            <thead>
                                <tr>
                                    <th className="has-text-grey">Date</th>
                                    <th className="has-text-grey">Player</th>
                                    <th className="has-text-grey">Station</th>
                                    <th className="has-text-grey">Duration</th>
                                    <th className="has-text-grey">Method</th>
                                    <th className="has-text-right has-text-grey">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length > 0 ? (
                                    filteredData.map((t, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                                            <td className="is-size-7">
                                                {new Date(t.startTime).toLocaleDateString()} <br />
                                                <span className="has-text-grey">{new Date(t.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td className="is-size-7 has-text-weight-bold">{t.players || t.userName}</td>
                                            <td className="is-size-7"><span className="tag is-dark is-primary is-outlined">{t.machine}</span></td>
                                            <td className="is-size-7">{t.duration}h</td>
                                            <td className="is-size-7"><span className={`tag is-small ${t.method === 'CASH' ? 'is-success' : 'is-info'} is-light`}>{t.method}</span></td>
                                            <td className="has-text-right has-text-weight-bold">Rs. {t.amountPaid}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="has-text-centered py-5 has-text-grey">No transactions found for this period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionsPage;