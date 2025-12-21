import React, { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner"; 
import { db } from "../../firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

const AdminPanel = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [userData, setUserData] = useState(null);
    const [view, setView] = useState("scanner"); // "scanner" or "report"
    const [isLocked, setIsLocked] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    const videoRef = useRef(null);
    const scannerRef = useRef(null);
    const audioRef = useRef(new Audio("/success.mp3"));

    // --- LOGIC HELPERS ---
    const getTodaySessions = (sessions) => {
        if (!sessions) return [];
        const today = new Date().toISOString().split('T')[0];
        return sessions.filter(s => s.startTime.startsWith(today));
    };

    const getTodayTotal = (sessions) => {
        return getTodaySessions(sessions).reduce((acc, s) => acc + parseFloat(s.duration), 0);
    };

    const getMonthlySessions = (sessions) => {
        if (!sessions) return [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return sessions
            .filter(s => new Date(s.startTime) >= thirtyDaysAgo)
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    };

    const handleScan = async (data) => {
        if (isLocked) return;
        try {
            const parsed = JSON.parse(data);
            if (userData && userData.uid === parsed.uid && view === "scanner") return;

            setIsLocked(true);
            scannerRef.current?.stop();

            const userDoc = await getDoc(doc(db, "users", parsed.uid));
            if (userDoc.exists()) {
                audioRef.current.play().catch(() => {});
                setUserData(userDoc.data());
                setView("scanner"); 
            }

            setTimeout(() => {
                setIsLocked(false);
                if (view === "scanner") scannerRef.current?.start();
            }, 1000);
        } catch (err) { console.error("QR Error", err); }
    };

    const addSession = async (hours) => {
        if (!userData) return;
        setIsUpdating(true);
        try {
            const userRef = doc(db, "users", userData.uid);
            await updateDoc(userRef, {
                sessions: arrayUnion({ startTime: new Date().toISOString(), duration: hours })
            });
            const updated = await getDoc(userRef);
            setUserData(updated.data());
        } catch (err) { console.error(err); }
        finally { setIsUpdating(false); }
    };

    useEffect(() => {
        if (isAdmin && view === "scanner" && videoRef.current) {
            scannerRef.current = new QrScanner(videoRef.current, (result) => handleScan(result.data), { highlightScanRegion: true });
            scannerRef.current.start();
        }
        return () => scannerRef.current?.destroy();
    }, [isAdmin, view]);

    if (!isAdmin) {
        return (
            <div className="section">
                <form className="box" style={{maxWidth: '400px', margin: 'auto'}} onSubmit={(e) => {
                    e.preventDefault();
                    if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
                }}>
                    <h1 className="title">Admin Login</h1>
                    <input className="input mb-3" type="password" placeholder="Access Key" onChange={(e) => setPassword(e.target.value)} />
                    <button className="button is-dark is-fullwidth">Login</button>
                </form>
            </div>
        );
    }

    // --- VIEW: MONTHLY REPORT ---
    if (view === "report" && userData) {
        const reportData = getMonthlySessions(userData.sessions);
        return (
            <div className="section">
                <div className="container" style={{maxWidth: '800px'}}>
                    <button className="button is-light mb-4" onClick={() => setView("scanner")}>← Back to Scanner</button>
                    <div className="box">
                        <h1 className="title">30-Day Activity Log</h1>
                        <h2 className="subtitle">{userData.fullName}</h2>
                        <table className="table is-fullwidth is-striped is-bordered">
                            <thead>
                                <tr><th>Date</th><th>Start Time</th><th>Duration</th></tr>
                            </thead>
                            <tbody>
                                {reportData.map((s, i) => (
                                    <tr key={i}>
                                        <td>{new Date(s.startTime).toLocaleDateString()}</td>
                                        <td>{new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                        <td>{s.duration} hr(s)</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button className="button is-dark is-fullwidth" onClick={() => window.print()}>Print Report</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW: MAIN SCANNER & TODAY'S LOG ---
    return (
        <div className="section">
            <div className="container">
                <div className="columns">
                    <div className="column is-4">
                        <div className="box has-background-black">
                            <h2 className="subtitle has-text-white">Scanner {isLocked ? "•" : "○"}</h2>
                            <video ref={videoRef} style={{ width: '100%', borderRadius: '4px' }}></video>
                        </div>
                    </div>
                    <div className="column is-8">
                        {userData ? (
                            <div className="box">
                                <div className="level">
                                    <div className="level-left"><h1 className="title is-4">{userData.fullName}</h1></div>
                                    <div className="level-right">
                                        <button className="button is-small is-link is-outlined" onClick={() => setView("report")}>📊 Full Report</button>
                                    </div>
                                </div>

                                <div className="columns">
                                    <div className="column is-6">
                                        <p><strong>Age:</strong> {userData.age}</p>
                                        <p><strong>School:</strong> {userData.school}</p>
                                    </div>
                                    <div className="column is-6 has-text-right">
                                        <p className="heading">Total Played Today</p>
                                        <p className="title is-3 has-text-success">{getTodayTotal(userData.sessions)}h</p>
                                    </div>
                                </div>

                                <hr />
                                <div className="field">
                                    <label className="label">Add Play Time</label>
                                    <div className="buttons">
                                        <button className={`button is-success ${isUpdating ? 'is-loading' : ''}`} onClick={() => addSession(0.5)}>+30m</button>
                                        <button className={`button is-info ${isUpdating ? 'is-loading' : ''}`} onClick={() => addSession(1)}>+1h</button>
                                        <button className={`button is-primary ${isUpdating ? 'is-loading' : ''}`} onClick={() => addSession(2)}>+2h</button>
                                    </div>
                                </div>

                                <h3 className="subtitle is-6 mt-5">Today's Sessions</h3>
                                <table className="table is-fullwidth is-narrow is-striped">
                                    <thead><tr><th>Time</th><th>Duration</th></tr></thead>
                                    <tbody>
                                        {getTodaySessions(userData.sessions).map((s, i) => (
                                            <tr key={i}>
                                                <td>{new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                                <td>{s.duration} hr(s)</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="notification has-text-centered">Ready to scan...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;