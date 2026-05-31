import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';

const AnalyticsPage = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [allUsers, setAllUsers] = useState([]);
    const [allEvents, setAllEvents] = useState([]); // Added state to track raw event data
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState("week"); // Default to week for better chart view
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

            // Live snapshot setup for real-time event invoices integration
            const unsubEvents = onSnapshot(collection(db, "event_invoices"), (snapshot) => {
                const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllEvents(eventsList);
            });

            return () => unsubEvents();
        }
    }, [isAdmin]);

    // Reusable timing boundaries parser mirroring original dashboard limit metrics
    const getDateLimits = () => {
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
        return { startLimit, endLimit };
    };

    const getFilteredData = () => {
        const { startLimit, endLimit } = getDateLimits();

        return allUsers.map(user => ({
            ...user,
            filteredSessions: (user.sessions || []).filter(s => {
                const sTime = new Date(s.startTime);
                return sTime >= startLimit && sTime <= endLimit;
            })
        }));
    };

    // New isolation layer parsing event invoices matching range constraints
    const getFilteredEvents = () => {
        const { startLimit, endLimit } = getDateLimits();

        return allEvents.filter(event => {
            // Checks eventDate field fallback to structural timestamp parameter if needed
            const eTime = new Date(event.eventDate || event.createdAt);
            return eTime >= startLimit && eTime <= endLimit;
        });
    };

    const filteredUsers = getFilteredData();
    const filteredEvents = getFilteredEvents(); // Parsed range events reference array

    // --- CHART LOGIC: DATE BY DATE ANALYSIS ---
    const getChartData = () => {
        const dailyMap = {};
        
        filteredUsers.forEach(u => {
            u.filteredSessions.forEach(s => {
                const dateKey = new Date(s.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (!dailyMap[dateKey]) {
                    dailyMap[dateKey] = { date: dateKey, revenue: 0, visits: 0 };
                }
                dailyMap[dateKey].revenue += (parseFloat(s.amountPaid) || 0);
                dailyMap[dateKey].visits += 1;
            });
        });

        // Appends filtered event bookings directly into matching daily coordinate keys
        filteredEvents.forEach(e => {
            const dateKey = new Date(e.eventDate || e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!dailyMap[dateKey]) {
                dailyMap[dateKey] = { date: dateKey, revenue: 0, visits: 0 };
            }
            dailyMap[dateKey].revenue += (parseFloat(e.amountPaid) || 0);
            // Event metrics are bundled separate from machine walk-in counts to keep counts accurate
        });

        // Convert map to sorted array
        return Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    // --- FINANCIALS ---
    const totalUserRevenue = filteredUsers.reduce((acc, u) => 
        acc + u.filteredSessions.reduce((sum, s) => sum + (parseFloat(s.amountPaid) || 0), 0), 0
    );
    // Combines standard profile transactions with bulk commercial event payments
    const totalEventRevenue = filteredEvents.reduce((acc, e) => acc + (parseFloat(e.amountPaid) || 0), 0);
    const totalRevenue = totalUserRevenue + totalEventRevenue;

    const totalSessions = filteredUsers.reduce((acc, u) => acc + u.filteredSessions.length, 0);
    const activeUserCount = allUsers.filter(u => {
        const lastSession = u.sessions?.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
        return lastSession && new Date(lastSession.startTime) > new Date(Date.now() - 2 * 60 * 60 * 1000);
    }).length;

    const getTopPlayers = () => {
        // Formulates list tracking standard spenders
        const spenders = filteredUsers
            .filter(u => u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(u => ({
                name: u.fullName,
                count: u.filteredSessions.length,
                revenue: u.filteredSessions.reduce((acc, s) => acc + (parseFloat(s.amountPaid) || 0), 0),
                isEvent: false
            }))
            .filter(u => u.count > 0);

        // Appends corporate/private client bookings into list entries array natively
        const events = filteredEvents
            .filter(e => e.clientName?.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(e => ({
                name: `💼 ${e.clientName} (Event)`,
                count: 1,
                revenue: parseFloat(e.amountPaid) || 0,
                isEvent: true
            }));

        // Merges arrays together sorting top aggregate revenue returns descending
        return [...spenders, ...events].sort((a, b) => b.revenue - a.revenue);
    };

    if (!isAdmin) return (
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
                    <button className="button is-primary is-fullwidth">Unlock</button>
                </form>
            </div>
        </section>
    );

    return (
        <section className="section" style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white' }}>
            <div className="container">
                
                {/* HEADER */}
                <div className="level mb-6">
                    <div className="level-left">
                        <div>
                            <h1 className="title has-text-white mb-0">Intelligence Dashboard</h1>
                            <p className="has-text-primary">Live Players: {activeUserCount}</p>
                        </div>
                    </div>
                    <div className="level-right">
                        <div className="field is-grouped">
                            {range === "custom" && (
                                <div className="control is-flex" style={{ gap: '5px' }}>
                                    <input className="input is-small is-dark" type="date" onChange={(e) => setStartDate(e.target.value)} />
                                    <input className="input is-small is-dark" type="date" onChange={(e) => setEndDate(e.target.value)} />
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

                {/* STATS CARDS */}
                <div className="columns is-multiline">
                    <div className="column is-4">
                        <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <p className="heading has-text-grey">Period Revenue</p>
                            <p className="title is-3 has-text-success">Rs. {totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="column is-4">
                        <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <p className="heading has-text-grey">Total Sessions</p>
                            <p className="title is-3 has-text-info">{totalSessions}</p>
                        </div>
                    </div>
                    <div className="column is-4">
                        <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <p className="heading has-text-grey">New Signups</p>
                            <p className="title is-3 has-text-white">
                                {allUsers.filter(u => {
                                    const d = new Date(u.createdAt || u.signupDate);
                                    return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                                }).length} <span className="is-size-6 has-text-grey">(This week)</span>
                            </p>
                        </div>
                    </div>

                    {/* DATE BY DATE CHART */}
                    <div className="column is-12">
                        <div className="box" style={{ background: '#1a1a1a', border: 'none' }}>
                            <h3 className="subtitle is-6 has-text-grey-light mb-5">Revenue Performance by Date ({range})</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={getChartData()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                        <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                            itemStyle={{ fontSize: '12px' }}
                                        />
                                        <Bar name="Revenue (Rs)" dataKey="revenue" fill="#00D1B2" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* PLAYER & EVENT LIST */}
                    <div className="column is-12">
                        <div className="box" style={{ background: '#1a1a1a' }}>
                            <div className="level">
                                <div className="level-left"><h3 className="subtitle is-6 has-text-grey-light">Top Spenders</h3></div>
                                <div className="level-right">
                                    <input className="input is-small is-dark" type="text" placeholder="Search..." onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <table className="table is-fullwidth is-dark" style={{ background: 'transparent' }}>
                                <thead>
                                    <tr>
                                        <th>Player / Client</th>
                                        <th className="has-text-centered">Visits</th>
                                        <th className="has-text-right">Total Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getTopPlayers().map((p, i) => (
                                        <tr key={i} style={p.isEvent ? { background: 'rgba(0, 209, 178, 0.02)' } : {}}>
                                            <td style={p.isEvent ? { color: '#00d1b2' } : {}}>{p.name}</td>
                                            <td className="has-text-centered">{p.count}</td>
                                            <td className="has-text-right has-text-weight-bold has-text-success">Rs. {p.revenue.toLocaleString()}</td>
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