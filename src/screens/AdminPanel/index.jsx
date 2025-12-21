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
    
    // NEW: State for manual phone search
    const [searchPhone, setSearchPhone] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);

    const videoRef = useRef(null);
    const scannerRef = useRef(null);
    const audioRef = useRef(new Audio("/success.mp3"));

    const PRICING = { 0.5: 500, 1: 1000, 2: 1800 };

    // --- NEW: MANUAL PHONE SEARCH LOGIC ---
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
                setSearchPhone(""); // Clear input on success
            } else {
                alert("No player found with that phone number.");
            }
        } catch (err) {
            console.error("Search Error", err);
        } finally {
            setSearchLoading(false);
        }
    };

    // --- EXISTING HELPERS ---
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
        } catch (err) { console.error("QR Error", err); }
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
            setTimeout(() => {
                window.print(); 
                setPendingTransaction(null);
                refreshUserData();
            }, 100);
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
            {/* PRINT-ONLY RECEIPT (Hidden on screen) */}
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
                    {/* LEFT: SCANNER & MANUAL SEARCH */}
                    <div className="column is-4">
                        <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                            <h2 className="subtitle is-6 has-text-grey-light">Scanner {isLocked ? "•" : "○"}</h2>
                            <video ref={videoRef} style={{ width: '100%', borderRadius: '8px', border: '1px solid #444', marginBottom: '1rem' }}></video>
                            
                            <hr style={{ background: '#333' }} />
                            
                            {/* NEW: Manual Search UI */}
                            <form onSubmit={handlePhoneSearch}>
                                <label className="label is-small has-text-grey-light">Manual Lookup (Phone)</label>
                                <div className="field has-addons">
                                    <div className="control is-expanded">
                                        <input 
                                            className="input is-dark is-small" 
                                            type="text" 
                                            placeholder="Ex: 0771234567" 
                                            value={searchPhone}
                                            onChange={(e) => setSearchPhone(e.target.value)}
                                            style={{ background: '#222', color: 'white' }}
                                        />
                                    </div>
                                    <div className="control">
                                        <button className={`button is-primary is-small ${searchLoading ? 'is-loading' : ''}`}>Find</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT: USER DASHBOARD */}
                    <div className="column is-8">
                        {userData ? (
                            <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }}>
                                {/* User Profile Header */}
                                <div className="level is-mobile">
                                    <div className="level-left">
                                        <figure className="image is-48x48 mr-3">
                                            <img className="is-rounded" src={`/avatars/${userData.avatar || '1.png'}`} style={{border: '2px solid #00d1b2'}} />
                                        </figure>
                                        <div>
                                            <h1 className="title is-4 has-text-white mb-0">{userData.fullName}</h1>
                                            <button className="button is-ghost is-small p-0 has-text-primary" onClick={() => setView("report")}>📊 View Full Report</button>
                                        </div>
                                    </div>
                                    <div className="level-right has-text-right">
                                        <p className="heading has-text-grey">Total Today</p>
                                        <p className="title is-3 has-text-success">{getTodayTotal(userData.sessions)}h</p>
                                    </div>
                                </div>

                                <div className="columns is-mobile mt-2">
                                    <div className="column is-6">
                                        <p className="is-size-7 has-text-grey">AGE: <span className="has-text-white">{userData.age}</span></p>
                                        <p className="is-size-7 has-text-grey">SCHOOL: <span className="has-text-white">{userData.school || "N/A"}</span></p>
                                    </div>
                                    <div className="column is-6 has-text-right">
                                        <p className="is-size-7 has-text-grey">PHONE: <span className="has-text-white">{userData.phone || "N/A"}</span></p>
                                    </div>
                                </div>

                                <hr style={{ background: '#333' }} />

                                {/* Billing Buttons */}
                                <label className="label has-text-grey-light">Purchase Session</label>
                                <div className="buttons">
                                    <button className="button is-success is-outlined" onClick={() => setPendingTransaction({hours: 0.5, price: PRICING[0.5]})}>+30m (Rs.500)</button>
                                    <button className="button is-info is-outlined" onClick={() => setPendingTransaction({hours: 1, price: PRICING[1]})}>+1h (Rs.1000)</button>
                                    <button className="button is-primary is-outlined" onClick={() => setPendingTransaction({hours: 2, price: PRICING[2]})}>+2h (Rs.1800)</button>
                                </div>

                                {pendingTransaction && (
                                    <div className="notification mt-4" style={{ background: '#00d1b211', border: '1px solid #00d1b2' }}>
                                        <p className="is-size-5 has-text-white mb-3">Pay <strong>Rs. {pendingTransaction.price}</strong>?</p>
                                        <div className="buttons">
                                            <button className="button is-success" onClick={() => confirmAndPrint("CASH")}>💵 Cash</button>
                                            <button className="button is-info" onClick={() => confirmAndPrint("CARD")}>💳 Card</button>
                                            <button className="button is-dark" onClick={() => setPendingTransaction(null)}>Cancel</button>
                                        </div>
                                    </div>
                                )}

                                {/* Recent Activity */}
                                <h3 className="subtitle is-6 mt-5 has-text-grey-light">Today's Session History</h3>
                                <table className="table is-fullwidth is-dark" style={{ background: 'transparent' }}>
                                    <thead><tr style={{color: '#444'}}><th>Time</th><th>Duration</th><th>Method</th></tr></thead>
                                    <tbody className="is-size-7">
                                        {getTodaySessions(userData.sessions).map((s, i) => (
                                            <tr key={i}>
                                                <td>{new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                                <td>{s.duration} hr(s)</td>
                                                <td className="has-text-primary">{s.method || "CASH"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                
                                <button className="button is-danger is-small is-light mt-4" onClick={() => setUserData(null)}>Clear Current Player</button>
                            </div>
                        ) : (
                            <div className="notification has-text-centered has-text-grey" style={{ background: '#121212', border: '1px dashed #333' }}>
                                Ready to Scan QR or Search Phone...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #receipt, #receipt * { visibility: visible; }
                    #receipt { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
                }
            `}</style>
        </div>
    );
};

export default AdminPanel;