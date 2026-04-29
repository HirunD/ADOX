import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AnalyticsPage = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState("lifetime");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
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

    const getFilteredData = () => {
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

        return allUsers.map(user => ({
            ...user,
            filteredSessions: (user.sessions || []).filter(s => {
                const sTime = new Date(s.startTime);
                return sTime >= startLimit && sTime <= endLimit;
            })
        }));
    };

    const filteredUsers = getFilteredData();

    // --- FINANCIAL CALCULATIONS ---
    const totalRevenue = filteredUsers.reduce((acc, u) => 
        acc + u.filteredSessions.reduce((sum, s) => sum + (parseFloat(s.amountPaid) || 0), 0), 0
    );

    const cashRevenue = filteredUsers.reduce((acc, u) => 
        acc + u.filteredSessions.filter(s => s.method === "Cash").reduce((sum, s) => sum + (parseFloat(s.amountPaid) || 0), 0), 0
    );

    const onlineRevenue = totalRevenue - cashRevenue;
    const totalSessions = filteredUsers.reduce((acc, u) => acc + u.filteredSessions.length, 0);
    const avgRevPerSession = totalSessions > 0 ? (totalRevenue / totalSessions).toFixed(2) : 0;

    const activeUserCount = allUsers.filter(u => {
        const lastSession = u.sessions?.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
        return lastSession && new Date(lastSession.startTime) > new Date(Date.now() - 2 * 60 * 60 * 1000);
    }).length;

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
                revenue: u.filteredSessions.reduce((acc, s) => acc + (parseFloat(s.amountPaid) || 0), 0),
                isLive: u.sessions?.some(s => new Date(s.startTime) > new Date(Date.now() - 2 * 60 * 60 * 1000))
            }))
            .filter(u => u.count > 0 || searchTerm !== "")
            .sort((a, b) => b.revenue - a.revenue);
    };

    if (!isAdmin) {
        return (
            <section className="section" style={{ background: '#1a1a1a', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
                <div className="container has-text-centered">
                    <form className="box" style={{ maxWidth: '400px', margin: 'auto', background: '#252525', border: '1px solid #333' }} 
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
                            else alert("Wrong Access Key");
                        }}>
                        <h2 className="title has-text-white">Admin Access</h2>
                        <input className="input is-dark mb-4" type="password" placeholder="Key" onChange={(e) => setPassword(e.target.value)} autoFocus />
                        <button className="button is-primary is-fullwidth">Unlock Analytics</button>
                    </form>
                </div>
            </section>
        );
    }

    if (loading) return <div className="section has-text-centered has-text-white">Analyzing Data...</div>;

    return (
        <section className="section" style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white' }}>
            <div className="container">
                
                {/* HEADER */}
                <div className="level mb-6">
                    <div className="level-left">
                        <div>
                            <h1 className="title has-text-white mb-0">ADOX Intelligence</h1>
                            <p className="has-text-primary">Live Active Players: {activeUserCount}</p>
                        </div>
                    </div>
                    <div className="level-right">
                        <div className="field is-grouped is-grouped-multiline">
                            {range === "custom" && (
                                <div className="control is-flex" style={{ gap: '10px' }}>
                                    <input className="input is-small is-dark" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    <input className="input is-small is-dark" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            )}
                            <div className="control">
                                <div className="select is-small">
                                    <select value={range} onChange={(e) => setRange(e.target.value)} style={{ background: '#252525', color: 'white' }}>
                                        <option value="today">Today</option>
                                        <option value="week">Last 7 Days</option>
                                        <option value="month">Last 30 Days</option>
                                        <option value="custom">Custom Range</option>
                                        <option value="lifetime">Lifetime</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FINANCIAL OVERVIEW */}
                <div className="columns is-multiline">
                    <div className="column is-3">
                        <div className="box" style={{ background: '#1a1a1a', borderLeft: '4px solid #48c774' }}>
                            <p className="heading has-text-grey">Total Sales (Rs.)</p>
                            <p className="title is-3 has-text-white">{totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="column is-3">
                        <div className="box" style={{ background: '#1a1a1a', borderLeft: '4px solid #3273dc' }}>
                            <p className="heading has-text-grey">Cash / Card</p>
                            <p className="title is-4 has-text-white">
                                <span className="has-text-success">{cashRevenue.toLocaleString()}</span> 
                                <span className="has-text-grey"> / </span> 
                                <span className="has-text-info">{onlineRevenue.toLocaleString()}</span>
                            </p>
                        </div>
                    </div>
                    <div className="column is-3">
                        <div className="box" style={{ background: '#1a1a1a', borderLeft: '4px solid #ffdd57' }}>
                            <p className="heading has-text-grey">Avg. Per Session</p>
                            <p className="title is-3 has-text-white">Rs. {avgRevPerSession}</p>
                        </div>
                    </div>
                    <div className="column is-3">
                        <div className="box" style={{ background: '#1a1a1a', borderLeft: '4px solid #f14668' }}>
                            <p className="heading has-text-grey">Total Hours</p>
                            <p className="title is-3 has-text-white">
                                {filteredUsers.reduce((acc, u) => acc + u.filteredSessions.reduce((sum, s) => sum + (parseFloat(s.duration) || 0), 0), 0).toFixed(1)}h
                            </p>
                        </div>
                    </div>

                    {/* CHART */}
                    <div className="column is-12">
                        <div className="box" style={{ background: '#1a1a1a', border: 'none' }}>
                            <h3 className="subtitle is-6 has-text-grey-light">Peak Traffic Hours ({range})</h3>
                            <div style={{ width: '100%', height: 250 }}>
                                <ResponsiveContainer>
                                    <BarChart data={getPeakData()}>
                                        <XAxis dataKey="hour" stroke="#444" fontSize={10} />
                                        <Tooltip cursor={{fill: '#222'}} contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                                        <Bar dataKey="visits" fill="#00D1B2" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* PLAYER ANALYSIS */}
                    <div className="column is-12">
                        <div className="box" style={{ background: '#1a1a1a' }}>
                            <div className="level mb-4">
                                <div className="level-left"><h3 className="subtitle is-6 has-text-grey-light">Revenue by Player</h3></div>
                                <div className="level-right">
                                    <input className="input is-small is-dark" type="text" placeholder="Search..." onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table is-fullwidth is-dark" style={{ background: 'transparent' }}>
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th className="has-text-centered">Visits</th>
                                            <th className="has-text-centered">Playtime</th>
                                            <th className="has-text-right">Total Spent</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getTopPlayers().map((p, i) => (
                                            <tr key={i}>
                                                <td>
                                                    {p.name} {p.isLive && <span className="tag is-success is-rounded is-small ml-2" style={{height: '1.2em'}}>LIVE</span>}
                                                </td>
                                                <td className="has-text-centered">{p.count}</td>
                                                <td className="has-text-centered">{p.totalHours.toFixed(1)}h</td>
                                                <td className="has-text-right has-text-weight-bold has-text-success">Rs. {p.revenue.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AnalyticsPage;