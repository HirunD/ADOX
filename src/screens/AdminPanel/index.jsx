import React, { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner"; 
import { db } from "../../firebase";
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";

const AdminPanel = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [userData, setUserData] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [pendingTransaction, setPendingTransaction] = useState(null);
    const [forceUnlock, setForceUnlock] = useState(false);

    // --- LIVE MONITOR STATES ---
    const [activeSessions, setActiveSessions] = useState([]);
    const [occupiedCount, setOccupiedCount] = useState(0);
    const [nextAvailableTime, setNextAvailableTime] = useState("Now");
    const TOTAL_MACHINES = 3;

    const [searchPhone, setSearchPhone] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);
    const [lapTime, setLapTime] = useState("");
    const [selectedRace, setSelectedRace] = useState("Spa - GT3");

    const videoRef = useRef(null);
    const scannerRef = useRef(null);
    const audioRef = useRef(new Audio("/success.mp3"));

    const PRICING = { 0.5: 500, 1: 1000, 2: 1800 };

    // --- LIVE MONITOR LOGIC ---
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const now = new Date();
            const active = [];

            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions) {
                    data.sessions.forEach(s => {
                        const start = new Date(s.startTime);
                        const end = new Date(start.getTime() + parseFloat(s.duration) * 3600000);
                        
                        if (now >= start && now < end) {
                            active.push({
                                name: data.fullName,
                                phone: data.phone,
                                endTime: end,
                                timeLeft: Math.round((end - now) / 60000) // minutes
                            });
                        }
                    });
                }
            });

            // Sort by who finishes first
            active.sort((a, b) => a.endTime - b.endTime);
            setActiveSessions(active);
            setOccupiedCount(active.length);

            // Calculate next available
            if (active.length < TOTAL_MACHINES) {
                setNextAvailableTime("Now");
            } else {
                // If full, the first person to finish is the next available slot
                const quickestFinish = active[0].endTime;
                setNextAvailableTime(quickestFinish.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
        });
        return () => unsubscribe();
    }, []);

    const isFull = occupiedCount >= TOTAL_MACHINES && !forceUnlock;

    // ... (Keep handlePhoneSearch, recordLap, handleScan, confirmAndPrint, refreshUserData the same) ...
    const confirmAndPrint = async (method) => {
        if (!userData || !pendingTransaction) return;
        if (occupiedCount >= TOTAL_MACHINES && !forceUnlock) {
            alert("STATIONS FULL!");
            return;
        }
        setIsUpdating(true);
        try {
            const userRef = doc(db, "users", userData.uid);
            const transaction = { 
                startTime: new Date().toISOString(), 
                duration: pendingTransaction.hours,
                amountPaid: pendingTransaction.price,
                method: method
            };
            await updateDoc(userRef, { sessions: arrayUnion(transaction) });
            setPendingTransaction({...pendingTransaction, method});
            setTimeout(() => { window.print(); setPendingTransaction(null); refreshUserData(); }, 100);
        } catch (err) { console.error(err); }
        finally { setIsUpdating(false); }
    };

    const recordLap = async () => {
        if (!userData || !lapTime) return;
        setIsUpdating(true);
        try {
            const userRef = doc(db, "users", userData.uid);
            const parts = lapTime.split(/[:.]/);
            let ms = 0;
            if (parts.length === 3) {
                ms = (parseInt(parts[0]) * 60000) + (parseInt(parts[1]) * 1000) + parseInt(parts[2].padEnd(3, '0').substring(0, 3));
            }
            const lapData = { raceName: selectedRace, timeStr: lapTime, timeMs: ms, recordedAt: new Date().toISOString() };
            await updateDoc(userRef, { laps: arrayUnion(lapData) });
            setLapTime("");
            alert(`✅ Lap recorded!`);
            refreshUserData();
        } catch (err) { console.error(err); } finally { setIsUpdating(false); }
    };

    const handlePhoneSearch = async (e) => {
        e.preventDefault();
        if (!searchPhone) return;
        setSearchLoading(true);
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("phone", "==", searchPhone));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                audioRef.current.play().catch(() => {});
                setUserData({ ...userDoc.data(), uid: userDoc.id });
                setSearchPhone("");
            } else { alert("No player found."); }
        } catch (err) { console.error(err); } finally { setSearchLoading(false); }
    };

    const handleScan = async (data) => {
        if (isLocked) return;
        try {
            const parsed = JSON.parse(data);
            if (userData && userData.uid === parsed.uid) return;
            setIsLocked(true);
            const userDoc = await getDoc(doc(db, "users", parsed.uid));
            if (userDoc.exists()) {
                audioRef.current.play().catch(() => {});
                setUserData({ ...userDoc.data(), uid: parsed.uid });
            }
            setTimeout(() => setIsLocked(false), 2000);
        } catch (err) { console.error(err); }
    };

    const refreshUserData = async () => {
        const userRef = doc(db, "users", userData.uid);
        const updated = await getDoc(userRef);
        setUserData({ ...updated.data(), uid: userData.uid });
    };

    useEffect(() => {
        if (isAdmin && videoRef.current) {
            scannerRef.current = new QrScanner(videoRef.current, (result) => handleScan(result.data), { highlightScanRegion: true });
            scannerRef.current.start();
        }
        return () => scannerRef.current?.destroy();
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <div className="section" style={{ background: '#050505', minHeight: '100vh' }}>
                <form className="box" style={{maxWidth: '400px', margin: '100px auto', background: '#1a1a1a', border: '1px solid #333'}} onSubmit={(e) => {
                    e.preventDefault();
                    if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
                }}>
                    <h1 className="title has-text-white">Admin Login</h1>
                    <input className="input is-dark mb-3" type="password" placeholder="Access Key" onChange={(e) => setPassword(e.target.value)} />
                    <button className="button is-primary is-fullwidth">Login</button>
                </form>
            </div>
        );
    }

    return (
        <div className="section" style={{ background: '#050505', minHeight: '100vh' }}>
            {/* ... Receipt code ... */}
            <div id="receipt" style={{ display: 'none' }}>
                <center style={{fontFamily: 'monospace'}}>
                    <h2>ADOX GAMING CENTER</h2>
                    <p>PLAYER: {userData?.fullName}</p>
                    <p>TIME: {pendingTransaction?.hours} hour(s)</p>
                    <p>PRICE: Rs.{pendingTransaction?.price}</p>
                    <p>METHOD: {pendingTransaction?.method}</p>
                    <p>DATE: {new Date().toLocaleString()}</p>
                    <p>THANK YOU!</p>
                </center>
            </div>

            <div className="container">
                <div className="columns">
                    {/* LEFT COLUMN: LIVE MONITOR & SCANNER */}
                    <div className="column is-4">
                        {/* NEXT AVAILABLE CARD */}
                        <div className="box mb-4" style={{ background: '#1a1a1a', border: '1px solid #00d1b2', textAlign: 'center' }}>
                            <p className="heading has-text-grey-light">Next Available Slot</p>
                            <p className="title is-3 has-text-primary">{nextAvailableTime}</p>
                        </div>

                        {/* LIVE SESSIONS LIST */}
                        <div className="box mb-4" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <h3 className="subtitle is-6 has-text-white mb-3">Live Stations ({occupiedCount}/{TOTAL_MACHINES})</h3>
                            {activeSessions.length > 0 ? activeSessions.map((s, i) => (
                                <div key={i} className="mb-2 p-2" style={{ background: '#222', borderRadius: '8px', borderLeft: '4px solid #00d1b2' }}>
                                    <p className="is-size-7 has-text-white has-text-weight-bold">{s.name}</p>
                                    <div className="is-flex is-justify-content-between">
                                        <span className="is-size-7 has-text-grey">{s.phone}</span>
                                        <span className="is-size-7 has-text-warning">{s.timeLeft}m left</span>
                                    </div>
                                </div>
                            )) : <p className="is-size-7 has-text-grey">All stations empty.</p>}
                        </div>

                        <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <h2 className="subtitle is-6 has-text-grey-light">Scanner</h2>
                            <video ref={videoRef} style={{ width: '100%', borderRadius: '8px', border: '1px solid #444' }}></video>
                            <label className="checkbox is-size-7 has-text-white mt-3">
                                <input type="checkbox" checked={forceUnlock} onChange={(e) => setForceUnlock(e.target.checked)} className="mr-2" />
                                Force Unlock Billing
                            </label>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: SEARCH & BILLING */}
                    <div className="column is-8">
                        {/* Search Bar at the top of Right Column */}
                        <div className="box mb-4" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <form onSubmit={handlePhoneSearch}>
                                <div className="field has-addons">
                                    <div className="control is-expanded">
                                        <input className="input is-dark" type="text" placeholder="Search Player by Phone..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
                                    </div>
                                    <div className="control">
                                        <button className={`button is-primary ${searchLoading ? 'is-loading' : ''}`}>Search</button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {userData ? (
                            <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }}>
                                {/* User profile & Billing logic same as previous version */}
                                <div className="level is-mobile mb-4">
                                    <div className="level-left">
                                        <figure className="image is-48x48 mr-3">
                                            <img className="is-rounded" src={`/avatars/${userData.avatar || '1.png'}`} style={{border: '2px solid #00d1b2'}} />
                                        </figure>
                                        <div>
                                            <h1 className="title is-4 has-text-white mb-0">{userData.fullName}</h1>
                                            <p className="is-size-7 has-text-grey">{userData.phone}</p>
                                        </div>
                                    </div>
                                    <div className="level-right">
                                        <button className="button is-danger is-small is-outlined" onClick={() => setUserData(null)}>Clear</button>
                                    </div>
                                </div>

                                <div className="columns">
                                    <div className="column is-6">
                                        <label className="label is-small has-text-primary">BILLING</label>
                                        {isFull ? <p className="has-text-danger is-size-7">Machines Full</p> : (
                                            <div className="buttons">
                                                <button className="button is-success is-small is-fullwidth" onClick={() => setPendingTransaction({hours: 0.5, price: PRICING[0.5]})}>30m - 500</button>
                                                <button className="button is-info is-small is-fullwidth" onClick={() => setPendingTransaction({hours: 1, price: PRICING[1]})}>1h - 1000</button>
                                                <button className="button is-primary is-small is-fullwidth" onClick={() => setPendingTransaction({hours: 2, price: PRICING[2]})}>2h - 1800</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="column is-6">
                                        <label className="label is-small has-text-warning">LAP RECORDER</label>
                                        <div className="field has-addons">
                                            <div className="control is-expanded">
                                                <input className="input is-small is-dark" type="text" placeholder="Time (1:24.500)" value={lapTime} onChange={(e) => setLapTime(e.target.value)} />
                                            </div>
                                            <div className="control">
                                                <button className="button is-warning is-small" onClick={recordLap}>Add</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {pendingTransaction && (
                                    <div className="notification mt-4" style={{ background: '#00d1b211', border: '1px solid #00d1b2' }}>
                                        <p>Total: <strong>Rs. {pendingTransaction.price}</strong></p>
                                        <div className="buttons">
                                            <button className="button is-success is-small" onClick={() => confirmAndPrint("CASH")}>Cash</button>
                                            <button className="button is-info is-small" onClick={() => confirmAndPrint("CARD")}>Card</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="notification has-text-centered has-text-grey" style={{ background: '#121212', border: '1px dashed #333', padding: '100px' }}>
                                Scan QR or Search Phone to Bill a Player
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @media print { body * { visibility: hidden; } #receipt, #receipt * { visibility: visible; } #receipt { position: absolute; left: 0; top: 0; width: 100%; display: block !important; } }
            `}</style>
        </div>
    );
};

export default AdminPanel;