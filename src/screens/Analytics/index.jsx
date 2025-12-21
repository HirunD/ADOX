import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const AnalyticsPage = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState("lifetime");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (isAdmin) {
            const fetchData = async () => {
                const querySnapshot = await getDocs(collection(db, "users"));
                const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllUsers(users);
                setLoading(false);
            };
            fetchData();
        }
    }, [isAdmin]);

    // --- LOGIC: DATE FILTERING ---
    const getFilteredData = () => {
        const now = new Date();
        let limit = new Date(0);
        if (range === "today") limit = new Date(now.setHours(0, 0, 0, 0));
        else if (range === "week") limit = new Date(now.setDate(now.getDate() - 7));
        else if (range === "month") limit = new Date(now.setMonth(now.getMonth() - 1));

        return allUsers.map(user => ({
            ...user,
            filteredSessions: (user.sessions || []).filter(s => new Date(s.startTime) >= limit)
        }));
    };

    const filteredUsers = getFilteredData();

    // --- LOGIC: ACTIVE USERS (Last 2 Hours) ---
    const activeUserCount = allUsers.filter(u => {
        const lastSession = u.sessions?.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
        return lastSession && new Date(lastSession.startTime) > new Date(Date.now() - 2 * 60 * 60 * 1000);
    }).length;

    // --- CHART DATA ---
    const getPeakData = () => {
        const hours = Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, visits: 0 }));
        filteredUsers.forEach(u => {
            u.filteredSessions.forEach(s => {
                const hour = new Date(s.startTime).getHours();
                hours[hour].visits += 1;
            });
        });
        return hours;
    };

    const getTopPlayers = () => {
        return filteredUsers
            .filter(u => u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(u => ({
                name: u.fullName,
                count: u.filteredSessions.length,
                totalHours: u.filteredSessions.reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0),
                isLive: u.sessions?.some(s => new Date(s.startTime) > new Date(Date.now() - 2 * 60 * 60 * 1000))
            }))
            .filter(u => u.count > 0 || searchTerm !== "")
            .sort((a, b) => b.count - a.count);
    };

    // --- LOGIN SCREEN ---
    if (!isAdmin) {
        return (
            <section className="section" style={{ background: '#1a1a1a', minHeight: '100vh' }}>
                <div className="container has-text-centered">
                    <form className="box" style={{ maxWidth: '400px', margin: 'auto', background: '#252525', border: 'none' }} 
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
                            else alert("Wrong Access Key");
                        }}>
                        <h2 className="title has-text-white">Admin Access</h2>
                        <input className="input mb-4" type="password" placeholder="Key" onChange={(e) => setPassword(e.target.value)} />
                        <button className="button is-primary is-fullwidth">Unlock Analytics</button>
                    </form>
                </div>
            </section>
        );
    }

    if (loading) return <div className="section has-text-centered has-text-white">Analyzing Data...</div>;

    return (
        <section className="section" style={{ background: '#1a1a1a', minHeight: '100vh', color: 'white' }}>
            <div className="container">
                
                {/* HEADER & SELECTOR */}
                <div className="level mb-6">
                    <div className="level-left">
                        <div>
                            <h1 className="title has-text-white mb-0">ADOX Intelligence</h1>
                            <p className="has-text-primary">Live Active Players: {activeUserCount}</p>
                        </div>
                    </div>
                    <div className="level-right mt-4">
                        <div className="field has-addons">
                            <p className="control">
                                <button className="button is-static is-dark">Time Range:</button>
                            </p>
                            <p className="control">
                                <span className="select">
                                    <select value={range} onChange={(e) => setRange(e.target.value)} style={{ background: '#333', color: 'white', borderColor: '#444' }}>
                                        <option value="today">Today</option>
                                        <option value="week">Last 7 Days</option>
                                        <option value="month">Last 30 Days</option>
                                        <option value="lifetime">Lifetime</option>
                                    </select>
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="columns is-multiline">
                    {/* VISITS CHART */}
                    <div className="column is-12">
                        <div className="box" style={{ background: '#252525', border: 'none' }}>
                            <h3 className="subtitle has-text-grey-light">Hourly Peak Times ({range})</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={getPeakData()}>
                                        <XAxis dataKey="hour" stroke="#888" fontSize={12} />
                                        <YAxis stroke="#888" />
                                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff' }} />
                                        <Bar dataKey="visits" fill="#00D1B2" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* STAT CARDS */}
                    <div className="column is-4">
                        <div className="box has-text-centered" style={{ background: '#252525', color: 'white', borderTop: '4px solid #00d1b2' }}>
                            <p className="heading">Total Sessions</p>
                            <p className="title is-2 has-text-white">{filteredUsers.reduce((acc, u) => acc + u.filteredSessions.length, 0)}</p>
                        </div>
                    </div>
                    <div className="column is-4">
                        <div className="box has-text-centered" style={{ background: '#252525', color: 'white', borderTop: '4px solid #3273dc' }}>
                            <p className="heading">Hours Logged</p>
                            <p className="title is-2 has-text-white">{filteredUsers.reduce((acc, u) => acc + u.filteredSessions.reduce((sum, s) => sum + (parseFloat(s.duration) || 0), 0), 0).toFixed(1)}h</p>
                        </div>
                    </div>
                    <div className="column is-4">
                        <div className="box has-text-centered" style={{ background: '#252525', color: 'white', borderTop: '4px solid #ffdd57' }}>
                            <p className="heading">Unique Players</p>
                            <p className="title is-2 has-text-white">{filteredUsers.filter(u => u.filteredSessions.length > 0).length}</p>
                        </div>
                    </div>

                    {/* PLAYER DATA TABLE */}
                    <div className="column is-12">
                        <div className="box" style={{ background: '#252525', color: 'white' }}>
                            <div className="level">
                                <div className="level-left">
                                    <h3 className="subtitle has-text-grey-light">Player Analysis</h3>
                                </div>
                                <div className="level-right">
                                    <input className="input is-dark" type="text" placeholder="Search name..." onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            
                            <table className="table is-fullwidth" style={{ background: 'transparent', color: 'white' }}>
                                <thead>
                                    <tr>
                                        <th className="has-text-grey">Status</th>
                                        <th className="has-text-grey">Player Name</th>
                                        <th className="has-text-grey">Visits</th>
                                        <th className="has-text-grey">Total Hours</th>
                                        <th className="has-text-grey">Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getTopPlayers().map((p, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                                            <td>{p.isLive ? <span className="tag is-success is-light">LIVE</span> : <span className="tag is-black">OFFLINE</span>}</td>
                                            <td className="has-text-weight-bold">{p.name}</td>
                                            <td>{p.count}</td>
                                            <td>{p.totalHours}h</td>
                                            <td className="has-text-success">+{p.totalHours * 2}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AnalyticsPage;