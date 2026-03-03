import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, collection, query, where, limit, orderBy, updateDoc } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";

const customStyles = `
  body { 
    margin: 0; 
    padding: 0; 
    font-family: 'Inter', sans-serif; 
  }
  
  .scroll-container { 
    min-height: 100vh; 
    padding: 20px 15px; 
    width: 100%; 
    display: block; 
    /* DEEP RED/BLACK BACKGROUND INSPIRED BY POSTER */
    background: radial-gradient(circle at top, #1a0505 0%, #000 70%);
  }
  
  /* Logo Normalization */
  .logo-wrapper { 
    height: 60px; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    margin-bottom: 25px; 
    width: 100%;
  }
  .logo-img {
    max-height: 100%;
    width: auto;
    object-fit: contain;
  }

  /* RE-DESIGNED INTERFACE BOX WITH INTENSE RED GRADIANT */
  .interface-box {
    /* Richer, deeper red gradient background */
    background: linear-gradient(135deg, rgba(255, 56, 96, 0.1) 0%, rgba(20, 0, 0, 0.7) 100%);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 56, 96, 0.3);
    border-radius: 20px;
    width: 100%;
    max-width: 450px;
    margin: 0 auto 12px auto;
    padding: 20px;
    box-sizing: border-box;
    box-shadow: 0 4px 15px rgba(255, 56, 96, 0.2);
  }
  
  /* RED PULSE */
  .live-pulse { width: 8px; height: 8px; background: #ff3860; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px #ff3860; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0% { transform: scale(0.9); opacity: 0.6; } 70% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.6; } }
  
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 450px; margin: 0 auto 12px auto; }
  .stat-box { 
    /* Deep red background for stat boxes */
    background: linear-gradient(135deg, rgba(255, 56, 96, 0.05) 0%, rgba(10, 0, 0, 0.8) 100%); 
    border: 1px solid rgba(255, 56, 96, 0.2); 
    border-radius: 20px; 
    padding: 15px; 
    text-align: center; 
    box-shadow: 0 4px 10px rgba(255, 56, 96, 0.1);
  }
  
  .schedule-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .schedule-row:last-child { border-bottom: none; }
  
  /* RED THEME TAGS */
  .time-tag { font-family: 'Monaco', monospace; color: #ff3860; font-weight: bold; }
  .end-time-badge { 
    background: rgba(255, 56, 96, 0.1); 
    color: #ff3860; 
    padding: 2px 8px; 
    border-radius: 6px; 
    font-size: 0.65rem; 
    font-weight: bold; 
    border: 1px solid rgba(255, 56, 96, 0.2);
  }

  .avatar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px; }
  .avatar-item { cursor: pointer; border-radius: 50%; border: 2px solid transparent; transition: 0.3s; width: 100%; height: auto; }
  .avatar-item.active { border-color: #ff3860; transform: scale(1.1); box-shadow: 0 0 10px rgba(255, 56, 96, 0.5); }
  
  .primary-red-text { color: #ff3860 !important; }
  
  /* VIBRANT RED LOGOUT BUTTON */
  .logout-btn {
    border: 1px solid #ff3860;
    background: transparent;
    color: #ff3860;
    border-radius: 5px;
    padding: 2px 8px;
    font-size: 0.6rem;
    cursor: pointer;
    transition: 0.3s;
    text-transform: uppercase;
  }
  .logout-btn:hover {
    background: #ff3860;
    color: white;
  }
  
  /* RED LOGIN BUTTON */
  .button.is-red-login { 
    background: linear-gradient(90deg, #ff3860 0%, #900 100%); 
    color: white; 
    border: none;
    font-weight: bold;
    transition: 0.3s;
    text-transform: uppercase;
  }
  .button.is-red-login:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 56, 96, 0.4); }
`;

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [livePlayers, setLivePlayers] = useState([]);
    const [allReservations, setAllReservations] = useState([]);
    const [authLoading, setAuthLoading] = useState(true);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);

    const TOTAL_STATIONS = 6;
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
                        const start = new Date(s.startTime);
                        const end = new Date(start.getTime() + (parseFloat(s.duration) * 3600000));
                        if (now >= start && now < end) {
                            const endClockTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            activeSessions.push({ 
                                name: data.fullName.split(' ')[0], 
                                machine: s.machine, 
                                avatar: data.avatar,
                                endsAt: endClockTime 
                            });
                        }
                    });
                }
            });
            setLivePlayers(activeSessions);
        });

        const today = new Date().toISOString().split('T')[0];
        const qRes = query(collection(db, "reservations"), where("date", "==", today));
        const unsubRes = onSnapshot(qRes, (snap) => {
            const list = [];
            snap.forEach(d => list.push(d.data()));
            setAllReservations(list.sort((a,b) => a.startTime.localeCompare(b.startTime)));
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
        } catch (err) {
            alert("Error updating avatar");
        }
    };

    if (authLoading) return <div className="has-text-centered py-6"><i className="fas fa-circle-notch fa-spin primary-red-text"></i></div>;

    return (
        <div className="scroll-container">
            <style>{customStyles}</style>

            <div className="logo-wrapper">
                <img src="/logo.png" alt="Logo" className="logo-img" />
            </div>

            {/* PLAYER SUMMARY */}
            {user && (
                <div className="interface-box">
                    <div className="is-flex is-align-items-center is-justify-content-between">
                        <div>
                            <p className="has-text-grey is-size-7 is-uppercase">Gamer Profile</p>
                            <h1 className="title is-5 has-text-white mb-0">{userData?.fullName?.split(' ')[0] || 'Player'}</h1>
                            <p className="is-size-7 primary-red-text">{userData?.totalHours || 0} Total Hours</p>
                        </div>
                        <div className="has-text-right">
                            <figure className="image is-48x48 mb-1">
                                <img className="is-rounded" src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"} style={{ border: '2px solid #ff3860', height: '48px', objectFit: 'cover' }} alt="profile" />
                            </figure>
                            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="button is-ghost is-small p-0 is-size-7 primary-red-text">Change Pic</button>
                        </div>
                    </div>

                    {showAvatarPicker && (
                        <div className="avatar-grid">
                            {avatars.map(a => (
                                <img 
                                    key={a} 
                                    src={`/avatars/${a}`} 
                                    className={`avatar-item ${userData?.avatar === a ? 'active' : ''}`}
                                    onClick={() => changeAvatar(a)}
                                    alt="option"
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* LIVE COUNT STATS */}
            <div className="stat-grid">
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">AVAILABLE</p>
                    <p className="is-size-3 has-text-weight-bold has-text-white">{Math.max(0, TOTAL_STATIONS - livePlayers.length)}</p>
                </div>
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">LIVE NOW</p>
                    <p className="is-size-3 has-text-weight-bold primary-red-text">{livePlayers.length}</p>
                </div>
            </div>

            {/* LIVE ACTIVITY */}
            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3"><span className="live-pulse"></span>Active Sessions</p>
                {livePlayers.length > 0 ? (
                    livePlayers.map((player, i) => (
                        <div key={i} className="is-flex is-align-items-center is-justify-content-between mb-3">
                            <div className="is-flex is-align-items-center">
                                <img src={`/avatars/${player.avatar || '1.png'}`} className="image is-24x24 is-rounded mr-2" alt="p" />
                                <p className="is-size-7 has-text-white">
                                    <b>{player.name}</b> <span className="has-text-grey mx-1">playing</span> <span className="primary-red-text">{player.machine}</span>
                                </p>
                            </div>
                            <span className="end-time-badge">Ends {player.endsAt}</span>
                        </div>
                    ))
                ) : (
                    <p className="is-size-7 has-text-grey-light italic">No players live right now.</p>
                )}
            </div>

            {/* SCHEDULE */}
            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3">Today's Reservations</p>
                {allReservations.length > 0 ? (
                    allReservations.map((res, i) => (
                        <div key={i} className="schedule-row">
                            <span className="time-tag is-size-7">{res.startTime}</span>
                            <span className="has-text-grey-light is-size-7">{res.machine}</span>
                            <span className="has-text-grey is-size-7">Reserved</span>
                        </div>
                    ))
                ) : (
                    <p className="is-size-7 has-text-grey">All stations available for walk-ins.</p>
                )}
            </div>

            {/* CHECK-IN PASS */}
            {user && (
                <div className="interface-box has-text-centered">
                    <p className="is-size-7 has-text-grey is-uppercase mb-3">Digital Check-in Pass</p>
                    <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '12px', boxShadow: '0 0 20px rgba(255, 56, 96, 0.3)' }}>
                        <QRCode value={JSON.stringify({ uid: user.uid })} size={120} />
                    </div>
                </div>
            )}

            {!user && (
                <div className="has-text-centered mt-4">
                     <Link to="/login" className="button is-red-login is-small is-rounded px-5">LOGIN TO RESPAWN</Link>
                </div>
            )}

            {user && (
                <div className="has-text-centered mt-4">
                    <button onClick={() => signOut(auth)} className="logout-btn">Log Out profile</button>
                </div>
            )}
            
            <div style={{ height: '50px' }}></div>
        </div>
    );
};

export default HomePage;