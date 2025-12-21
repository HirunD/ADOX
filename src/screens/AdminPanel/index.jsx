import React, { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner"; 
import { db } from "../../firebase";
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from "firebase/firestore";

const AdminPanel = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [userData, setUserData] = useState(null);
    const [view, setView] = useState("scanner"); 
    const [isLocked, setIsLocked] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [pendingTransaction, setPendingTransaction] = useState(null);
    
    // Manual phone search
    const [searchPhone, setSearchPhone] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);

    // NEW: Lap Recorder States
    const [lapTime, setLapTime] = useState("");
    const [selectedRace, setSelectedRace] = useState("Spa - GT3");

    const videoRef = useRef(null);
    const scannerRef = useRef(null);
    const audioRef = useRef(new Audio("/success.mp3"));

    const PRICING = { 0.5: 500, 1: 1000, 2: 1800 };

    // --- NEW: LAP RECORDING LOGIC ---
    const recordLap = async () => {
        if (!userData || !lapTime) return;
        setIsUpdating(true);
        try {
            const userRef = doc(db, "users", userData.uid);
            
            // Convert M:SS.ms to milliseconds for sorting
            const parts = lapTime.split(/[:.]/);
            let ms = 0;
            if (parts.length === 3) { // M:SS.ms
                ms = (parseInt(parts[0]) * 60000) + (parseInt(parts[1]) * 1000) + parseInt(parts[2].padEnd(3, '0').substring(0, 3));
            }

            const lapData = {
                raceName: selectedRace,
                timeStr: lapTime,
                timeMs: ms,
                recordedAt: new Date().toISOString()
            };

            await updateDoc(userRef, { laps: arrayUnion(lapData) });
            setLapTime("");
            alert(`✅ Lap recorded for ${userData.fullName} on ${selectedRace}`);
            refreshUserData();
        } catch (err) {
            console.error("Lap Error", err);
            alert("Error saving lap time.");
        } finally {
            setIsUpdating(false);
        }
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
        } catch (err) { console.error(err); } 
        finally { setSearchLoading(false); }
    };

    const getTodaySessions = (sessions) => {
        if (!sessions) return [];
        const today = new Date().toISOString().split('T')[0];
        return sessions.filter(s => s.startTime.startsWith(today));
    };

    const getTodayTotal = (sessions) => {
        return getTodaySessions(sessions).reduce((acc, s) => acc + parseFloat(s.duration), 0);
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

    const confirmAndPrint = async (method) => {
        if (!userData || !pendingTransaction) return;
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

    const refreshUserData = async () => {
        const userRef = doc(db, "users", userData.uid);
        const updated = await getDoc(userRef);
        setUserData({ ...updated.data(), uid: userData.uid });
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
                    <div className="column is-4">
                        <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <h2 className="subtitle is-6 has-text-grey-light">Scanner {isLocked ? "•" : "○"}</h2>
                            <video ref={videoRef} style={{ width: '100%', borderRadius: '8px', border: '1px solid #444', marginBottom: '1rem' }}></video>
                            <hr style={{ background: '#333' }} />
                            <form onSubmit={handlePhoneSearch}>
                                <label className="label is-small has-text-grey-light">Manual Lookup (Phone)</label>
                                <div className="field has-addons">
                                    <div className="control is-expanded">
                                        <input className="input is-dark is-small" type="text" placeholder="Ex: 0771234567" value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} style={{ background: '#222', color: 'white' }} />
                                    </div>
                                    <div className="control">
                                        <button className={`button is-primary is-small ${searchLoading ? 'is-loading' : ''}`}>Find</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="column is-8">
                        {userData ? (
                            <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }}>
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
                                        <button className="button is-danger is-small is-outlined" onClick={() => setUserData(null)}>Logout Player</button>
                                    </div>
                                </div>

                                <div className="columns">
                                    {/* BILLING SECTION */}
                                    <div className="column is-6">
                                        <label className="label is-small has-text-primary">SESSION BILLING</label>
                                        <div className="buttons">
                                            <button className="button is-success is-small is-fullwidth" onClick={() => setPendingTransaction({hours: 0.5, price: PRICING[0.5]})}>30m - Rs.500</button>
                                            <button className="button is-info is-small is-fullwidth" onClick={() => setPendingTransaction({hours: 1, price: PRICING[1]})}>1h - Rs.1000</button>
                                            <button className="button is-primary is-small is-fullwidth" onClick={() => setPendingTransaction({hours: 2, price: PRICING[2]})}>2h - Rs.1800</button>
                                        </div>
                                    </div>

                                    {/* LAP RECORDER SECTION */}
                                    <div className="column is-6" style={{borderLeft: '1px solid #333'}}>
                                        <label className="label is-small has-text-warning">LAP RECORDER</label>
                                        <div className="field">
                                            <div className="control">
                                                <div className="select is-small is-fullwidth is-dark">
                                                    <select value={selectedRace} onChange={(e) => setSelectedRace(e.target.value)} style={{background: '#222', color: 'white'}}>
                                                        <option>Spa - GT3</option>
                                                        <option>Monza - F1</option>
                                                        <option>Nurburgring - GT3</option>
                                                        <option>Suzuka - Super Formula</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="field has-addons">
                                            <div className="control is-expanded">
                                                <input className="input is-small is-dark" type="text" placeholder="1:24.500" value={lapTime} onChange={(e) => setLapTime(e.target.value)} style={{background: '#222', color: 'white'}} />
                                            </div>
                                            <div className="control">
                                                <button className={`button is-warning is-small ${isUpdating ? 'is-loading' : ''}`} onClick={recordLap}>Add</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {pendingTransaction && (
                                    <div className="notification mt-4" style={{ background: '#00d1b211', border: '1px solid #00d1b2' }}>
                                        <p className="has-text-white mb-2">Confirm <strong>Rs. {pendingTransaction.price}</strong> payment?</p>
                                        <div className="buttons">
                                            <button className="button is-success is-small" onClick={() => confirmAndPrint("CASH")}>💵 Cash</button>
                                            <button className="button is-info is-small" onClick={() => confirmAndPrint("CARD")}>💳 Card</button>
                                            <button className="button is-dark is-small" onClick={() => setPendingTransaction(null)}>Cancel</button>
                                        </div>
                                    </div>
                                )}

                                <hr style={{ background: '#333' }} />
                                <h3 className="subtitle is-7 has-text-grey-light mb-2 uppercase">Recent Activity Today</h3>
                                <table className="table is-fullwidth is-dark is-narrow" style={{ background: 'transparent' }}>
                                    <tbody className="is-size-7">
                                        {getTodaySessions(userData.sessions).map((s, i) => (
                                            <tr key={i}>
                                                <td>{new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                                <td>{s.duration} hr(s)</td>
                                                <td className="has-text-primary">{s.method}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="notification has-text-centered has-text-grey" style={{ background: '#121212', border: '1px dashed #333', padding: '100px' }}>
                                Ready to Scan QR or Search Phone...
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