import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, collection, query, where, updateDoc } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";

const customStyles = `
  body { background-color: #080808; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  .scroll-container { min-height: 100vh; padding: 20px 15px; width: 100%; display: block; }
  .logo-wrapper { display: flex; align-items: center; justify-content: center; margin-bottom: 25px; width: 100%; }
  .logo-img { max-height: 60px; max-width: 200px; width: auto; height: auto; object-fit: contain; }
  .reward-banner { width: 100%; max-width: 450px; background: linear-gradient(145deg, #00d1b2 0%, #006b5a 100%); border-radius: 24px; padding: 25px 20px; text-align: center; margin: 0 auto 20px auto; box-shadow: 0 15px 30px rgba(0, 209, 178, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); }
  .claim-btn { display: inline-block; background: #fff; color: #006b5a; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; animation: pulse 2s infinite; }
  .interface-box { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; width: 100%; max-width: 450px; margin: 0 auto 12px auto; padding: 20px; box-sizing: border-box; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 450px; margin: 0 auto 12px auto; }
  .stat-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 15px; text-align: center; }
  .live-pulse { width: 8px; height: 8px; background: #00d1b2; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 8px #00d1b2; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.7; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.7; } }
  .schedule-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .avatar-item { cursor: pointer; border-radius: 50%; border: 2px solid transparent; transition: 0.3s; }
  .avatar-item.active { border-color: #00d1b2; transform: scale(1.1); }
`;

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [livePlayers, setLivePlayers] = useState([]);
    const [allReservations, setAllReservations] = useState([]);
    const [authLoading, setAuthLoading] = useState(true);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);

    const TOTAL_STATIONS = 5; 
    const avatars = ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png"];

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        const unsubGlobal = onSnapshot(collection(db, "users"), (snapshot) => {
            let activeSessions = [];
            const now = new Date();

            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions) {
                    data.sessions.forEach(s => {
                        if (s.machine === "PS4 #3") return;
                        const start = new Date(s.startTime);
                        const durationHrs = parseFloat(s.duration) || 0;
                        const end = new Date(start.getTime() + (durationHrs * 3600000));

                        if (now >= start && now < end) {
                            const diffMs = end - now;
                            const diffMins = Math.round(diffMs / 60000);
                            activeSessions.push({
                                name: (s.players || data.fullName).split(' ')[0],
                                machine: s.machine,
                                avatar: data.avatar,
                                timeLeft: diffMins,
                                endsAt: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            });
                        }
                    });
                }
            });
            setLivePlayers(activeSessions.sort((a, b) => a.timeLeft - b.timeLeft));
        });

        const today = new Date().toISOString().split('T')[0];
        const qRes = query(collection(db, "reservations"), where("date", "==", today));
        const unsubRes = onSnapshot(qRes, (snap) => {
            const list = [];
            snap.forEach(d => list.push(d.data()));
            setAllReservations(list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
        });

        if (user) {
            onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) setUserData(docSnap.data());
            });
        }
        return () => { unsubGlobal(); unsubRes(); };
    }, [user]);

    const changeAvatar = async (img) => {
        try {
            await updateDoc(doc(db, "users", user.uid), { avatar: img });
            setShowAvatarPicker(false);
        } catch (err) { alert("Error updating avatar"); }
    };

    if (authLoading) return <div className="has-text-centered py-6"><i className="fas fa-circle-notch fa-spin has-text-primary"></i></div>;

    return (
        <div className="scroll-container">
            <style>{customStyles}</style>
            <div className="logo-wrapper"><img src="/logo.png" alt="Logo" className="logo-img" /></div>

            {!user && (
                <div className="reward-banner">
                    <h2>READY TO RACE?</h2>
                    <p>Sign up now to track your <span style={{ background: "#fff", color: "#006b5a", padding: "2px 8px", borderRadius: "5px", fontWeight: "800" }}>BEST LAPS</span> and more!</p>
                    <Link to="/signup" className="claim-btn">CREATE PLAYER ID</Link>
                </div>
            )}

            {user && (
                <div className="interface-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p className="has-text-grey is-size-7 is-uppercase">Gamer Profile</p>
                            <h1 className="title is-5 has-text-white mb-0">{userData?.fullName?.split(' ')[0] || 'Player'}</h1>
                            <p className="is-size-7 has-text-primary">{userData?.totalHours || 0} Total Hours</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <img className="is-rounded" src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"} style={{ border: '2px solid #00d1b2', height: '48px', width: '48px', objectFit: 'cover', borderRadius: '50%' }} alt="profile" />
                            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="button is-ghost is-small p-0 is-size-7 has-text-primary">Change Pic</button>
                        </div>
                    </div>
                    {showAvatarPicker && (
                        <div className="avatar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '15px' }}>
                            {avatars.map(a => (
                                <img key={a} src={`/avatars/${a}`} className={`avatar-item ${userData?.avatar === a ? 'active' : ''}`} onClick={() => changeAvatar(a)} alt="option" />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="stat-grid">
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">AVAILABLE</p>
                    <p className="is-size-3 has-text-weight-bold has-text-success">{Math.max(0, TOTAL_STATIONS - livePlayers.length)}</p>
                </div>
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">LIVE NOW</p>
                    <p className="is-size-3 has-text-weight-bold has-text-white">{livePlayers.length}</p>
                </div>
            </div>

            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3"><span className="live-pulse"></span>Live Sessions</p>
                {livePlayers.length > 0 ? (
                    livePlayers.map((player, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="mb-3">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img src={`/avatars/${player.avatar || '1.png'}`} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="p" />
                                <p className="is-size-7 has-text-white" style={{ margin: 0 }}>
                                    <b>{player.name}</b> <span className="has-text-grey">on</span> <span className="has-text-primary">{player.machine}</span>
                                </p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                                <p className="is-size-7 has-text-weight-bold has-text-primary" style={{ margin: 0 }}>{player.timeLeft}m left</p>
                                <span style={{ fontSize: '10px', color: '#888' }}>Ends {player.endsAt}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="is-size-7 has-text-grey-light italic">No players currently live.</p>
                )}
            </div>

            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3">Today's Bookings</p>
                {allReservations.length > 0 ? (
                    allReservations.map((res, i) => (
                        <div key={i} className="schedule-row">
                            <span className="time-tag is-size-7" style={{ color: '#00d1b2' }}>{res.startTime}</span>
                            <span className="has-text-grey-light is-size-7">{res.machine}</span>
                            <span className="has-text-grey is-size-7">Reserved</span>
                        </div>
                    ))
                ) : (
                    <p className="is-size-7 has-text-grey">Stations available for walk-in.</p>
                )}
            </div>

            {user && (
                <div className="interface-box has-text-centered">
                    <p className="is-size-7 has-text-grey is-uppercase mb-3">Check-in Pass</p>
                    <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '12px' }}>
                        <QRCode value={JSON.stringify({ uid: user.uid })} size={120} />
                    </div>
                </div>
            )}


            {/* NEW BOOKING BANNER */}
            <div className="interface-box" style={{ background: 'linear-gradient(145deg, #25D366 0%, #128C7E 100%)', border: 'none', textAlign: 'center' }}>
                <p className="is-size-7 is-uppercase has-text-weight-bold" style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '5px' }}>Instant Reservation</p>
                <h3 className="title is-5 has-text-white mb-3">Book Your Session</h3>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <a href="https://wa.me/94778662814" target="_blank" rel="noreferrer" className="button is-white is-small is-rounded has-text-weight-bold" style={{ color: '#128C7E' }}>
                        <span>WHATSAPP</span>
                    </a>
                    <a href="tel:+94778662814" className="button is-white is-outlined is-small is-rounded has-text-weight-bold">
                        <span>CALL NOW</span>
                    </a>
                </div>
            </div>


            {!user && (
                <div className="has-text-centered mt-4">
                    <Link to="/login" className="button is-primary is-outlined is-small is-rounded px-5">LOGIN TO START</Link>
                </div>
            )}

            {user && (
                <div className="has-text-centered mt-4">
                    <button onClick={() => signOut(auth)} className="button is-ghost is-small has-text-grey">Log Out</button>
                </div>
            )}
            
        </div>
    );
};

export default HomePage;