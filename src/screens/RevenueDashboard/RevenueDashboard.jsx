import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";

const RevenueDashboard = () => {
    const TOTAL_MACHINES = 3;
    const [isOwner, setIsOwner] = useState(false);
    const [password, setPassword] = useState("");
    const [stats, setStats] = useState({
        today: 0,
        week: 0,
        lifetime: 0,
        cashToday: 0,
        cardToday: 0,
        totalHours: 0
    });
    const [loading, setLoading] = useState(true);

    // Fetch Financial Data
    useEffect(() => {
        if (!isOwner) return; // Only fetch if logged in

        const usersRef = collection(db, "users");
        const unsubscribe = onSnapshot(usersRef, (snapshot) => {
            let t = 0, w = 0, l = 0, cashT = 0, cardT = 0, hours = 0;
            const now = new Date();
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);

            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions) {
                    data.sessions.forEach(s => {
                        const sessionDate = new Date(s.startTime);
                        const amount = parseFloat(s.amountPaid) || 0;
                        const duration = parseFloat(s.duration) || 0;

                        l += amount;
                        hours += duration;

                        if (sessionDate >= startOfToday) {
                            t += amount;
                            if (s.method === "CASH") cashT += amount;
                            if (s.method === "CARD") cardT += amount;
                        }
                        if (sessionDate >= lastWeek) {
                            w += amount;
                        }
                    });
                }
            });

            setStats({ today: t, week: w, lifetime: l, cashToday: cashT, cardToday: cardT, totalHours: hours });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOwner]);

    const containerStyle = { background: '#050505', minHeight: '100vh', color: 'white' };
    const statBox = { background: '#121212', border: '1px solid #222', borderRadius: '15px', padding: '20px' };

    // --- GATE: OWNER LOGIN ---
    if (!isOwner) {
        return (
            <div className="section" style={{ background: '#050505', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
                <form className="box" style={{ maxWidth: '400px', margin: 'auto', background: '#1a1a1a', border: '1px solid #333' }} onSubmit={(e) => {
                    e.preventDefault();
                    // Uses the same secret key as your admin panel
                    if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsOwner(true);
                }}>
                    <div className="has-text-centered mb-5">
                        <span className="icon is-large has-text-primary">
                            <i className="fas fa-vault fa-2x"></i>
                        </span>
                        <h1 className="title is-4 has-text-white mt-3">Vault Access</h1>
                        <p className="subtitle is-7 has-text-grey">Owner identification required</p>
                    </div>
                    <input 
                        className="input is-dark mb-4" 
                        style={{ background: '#252525', color: 'white', border: '1px solid #444' }} 
                        type="password" 
                        placeholder="Master Key" 
                        autoFocus
                        onChange={(e) => setPassword(e.target.value)} 
                    />
                    <button className="button is-primary is-fullwidth has-text-weight-bold">Unlock Revenue</button>
                    <Link to="/admin" className="button is-text is-fullwidth is-small mt-3 has-text-grey" style={{textDecoration: 'none'}}>Return to Terminal</Link>
                </form>
            </div>
        );
    }

    if (loading) return <div className="section has-text-centered" style={containerStyle}><p className="mt-6">Analyzing Records...</p></div>;

    return (
        <section className="section" style={containerStyle}>
            <div className="container">
                <div className="level is-mobile mb-6">
                    <div className="level-left">
                        <div>
                            <h1 className="title has-text-white mb-1">Financial Intelligence</h1>
                            <p className="subtitle is-6 has-text-primary">ADOX Gaming Center</p>
                        </div>
                    </div>
                    <div className="level-right">
                        <div className="buttons">
                            <button className="button is-dark is-small" onClick={() => setIsOwner(false)}>🔒 Lock</button>
                            <Link to="/admin" className="button is-dark is-small">← Terminal</Link>
                        </div>
                    </div>
                </div>

                <div className="columns is-multiline">
                    {/* Today */}
                    <div className="column is-4">
                        <div style={statBox}>
                            <p className="heading has-text-grey">Today's Revenue</p>
                            <p className="title is-2 has-text-success">Rs. {stats.today.toLocaleString()}</p>
                            <hr style={{ background: '#222' }} />
                            <div className="is-flex is-justify-content-space-between">
                                <span className="has-text-grey-light is-size-7">💵 CASH: Rs. {stats.cashToday}</span>
                                <span className="has-text-grey-light is-size-7">💳 CARD: Rs. {stats.cardToday}</span>
                            </div>
                        </div>
                    </div>

                    {/* Week */}
                    <div className="column is-4">
                        <div style={statBox}>
                            <p className="heading has-text-grey">Last 7 Days</p>
                            <p className="title is-2 has-text-info">Rs. {stats.week.toLocaleString()}</p>
                            <p className="is-size-7 has-text-grey-light mt-4">Average: Rs. {Math.round(stats.week / 7).toLocaleString()} / day</p>
                        </div>
                    </div>

                    {/* Lifetime */}
                    <div className="column is-4">
                        <div style={statBox}>
                            <p className="heading has-text-grey">Lifetime Earnings</p>
                            <p className="title is-2 has-text-white">Rs. {stats.lifetime.toLocaleString()}</p>
                            <p className="is-size-7 has-text-primary mt-4">Total Playtime: {stats.totalHours.toFixed(1)} Hours</p>
                        </div>
                    </div>
                </div>

                {/* Performance Summary */}
                <div className="box mt-5" style={{ background: '#0a0a0a', border: '1px solid #00d1b244', borderRadius: '20px' }}>
                    <div className="columns is-vcentered">
                        <div className="column is-8">
                            <h3 className="subtitle is-5 has-text-white mb-2">Performance Summary</h3>
                            <p className="has-text-grey is-size-7">
                                You are generating <strong>Rs. {stats.totalHours > 0 ? (stats.lifetime / stats.totalHours).toFixed(2) : 0}</strong> per hour of machine usage.
                            </p>
                        </div>
                        <div className="column is-4 has-text-right">
                            <button className="button is-primary is-outlined is-small" onClick={() => window.print()}>Export PDF Report</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RevenueDashboard;