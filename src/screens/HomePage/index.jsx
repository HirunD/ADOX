import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, collection, query, where, limit, orderBy, updateDoc } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";

const customStyles = `
  body { background-color: #080808; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  .scroll-container { min-height: 100vh; padding: 20px 15px; width: 100%; display: block; }
  .interface-box {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    width: 100%;
    max-width: 450px;
    margin: 0 auto 12px auto;
    padding: 20px;
    box-sizing: border-box;
  }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 450px; margin: 0 auto 12px auto; }
  .stat-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 15px; text-align: center; }
  .live-pulse { width: 8px; height: 8px; background: #00d1b2; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 8px #00d1b2; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.7; } 70% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.7; } }
  .gaming-banner { background: linear-gradient(135deg, #00d1b2 0%, #006b5a 100%); border-radius: 24px; padding: 30px 20px; text-align: center; color: white; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1); }
  
  /* Avatar Picker Styles */
  .avatar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px; }
  .avatar-item { cursor: pointer; border-radius: 50%; border: 2px solid transparent; transition: 0.3s; }
  .avatar-item.active { border-color: #00d1b2; transform: scale(1.1); }
`;

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [livePlayers, setLivePlayers] = useState([]);
    const [topGamers, setTopGamers] = useState([]);
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
        const qLeader = query(collection(db, "users"), orderBy("totalHours", "desc"), limit(3));
        const unsubLeader = onSnapshot(qLeader, (snap) => {
            const gamers = [];
            snap.forEach(d => gamers.push(d.data()));
            setTopGamers(gamers);
        });

        const unsubGlobal = onSnapshot(collection(db, "users"), (snapshot) => {
            let activeSessions = [];
            const now = new Date();
            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions) {
                    data.sessions.forEach(s => {
                        const start = new Date(s.startTime);
                        const end = new Date(start.getTime() + (parseFloat(s.duration) * 60 * 60 * 1000));
                        if (now >= start && now < end) {
                            activeSessions.push({ name: data.fullName.split(' ')[0], machine: s.machine, avatar: data.avatar });
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

        return () => { unsubLeader(); unsubGlobal(); unsubRes(); };
    }, [user]);

    const changeAvatar = async (img) => {
        try {
            await updateDoc(doc(db, "users", user.uid), { avatar: img });
            setShowAvatarPicker(false);
        } catch (err) {
            alert("Error updating avatar");
        }
    };

    if (authLoading) return <div className="has-text-centered py-6"><i className="fas fa-circle-notch fa-spin has-text-primary"></i></div>;

    return (
        <div className="scroll-container">
            <style>{customStyles}</style>

            <div className="has-text-centered mb-5">
                <img src="/logo.png" alt="Logo" style={{ width: "90px" }} />
            </div>

            {/* PLAYER PROFILE & AVATAR EDIT */}
            {user && (
                <div className="interface-box">
                    <div className="is-flex is-align-items-center is-justify-content-between">
                        <div>
                            <p className="has-text-grey is-size-7 is-uppercase">Gamer Profile</p>
                            <h1 className="title is-5 has-text-white mb-0">{userData?.fullName?.split(' ')[0] || 'Player'}</h1>
                            <p className="is-size-7 has-text-primary">{userData?.totalHours || 0} Total Hours</p>
                        </div>
                        <div className="has-text-right">
                            <figure className="image is-48x48 mb-1" style={{ margin: '0 auto' }}>
                                <img className="is-rounded" src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"} style={{ border: '2px solid #00d1b2' }} alt="profile" />
                            </figure>
                            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="button is-ghost is-small p-0 is-size-7 has-text-primary">Change Pic</button>
                        </div>
                    </div>

                    {/* HIDDEN AVATAR PICKER */}
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

            {!user && (
                <div className="gaming-banner mx-auto" style={{ maxWidth: '450px' }}>
                    <h2 className="title is-4 has-text-white mb-2">JOIN THE HUB</h2>
                    <p className="is-size-7 mb-4">Track your hours and rank up against Galle's best.</p>
                    <Link to="/login" className="button is-white is-rounded has-text-weight-bold px-5" style={{ color: '#006b5a' }}>LOGIN TO PLAY</Link>
                </div>
            )}

            {/* CAFE STATUS */}
            <div className="stat-grid">
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">AVAILABLE</p>
                    <p className="is-size-3 has-text-weight-bold has-text-success">{TOTAL_STATIONS - livePlayers.length}</p>
                </div>
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">LIVE NOW</p>
                    <p className="is-size-3 has-text-weight-bold has-text-white">{livePlayers.length}</p>
                </div>
            </div>

            {/* LIVE ACTIVITY */}
            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3"><span className="live-pulse"></span>Live Sessions</p>
                {livePlayers.length > 0 ? (
                    livePlayers.map((player, i) => (
                        <div key={i} className="is-flex is-align-items-center mb-3">
                            <img src={`/avatars/${player.avatar || '1.png'}`} className="image is-24x24 is-rounded mr-2" alt="p" />
                            <p className="is-size-7 has-text-white"><b>{player.name}</b> on <span className="has-text-primary">{player.machine}</span></p>
                        </div>
                    ))
                ) : (
                    <p className="is-size-7 has-text-grey-light italic">No active sessions.</p>
                )}
            </div>

            {/* UPCOMING RESERVATIONS */}
            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3">Reservations</p>
                {allReservations.length > 0 ? (
                    allReservations.slice(0, 4).map((res, i) => (
                        <div key={i} className="is-flex is-justify-content-between mb-2">
                            <p className="is-size-7 has-text-white">{res.startTime} - {res.machine}</p>
                            <span className="tag is-primary is-light is-rounded is-small">Reserved</span>
                        </div>
                    ))
                ) : (
                    <p className="is-size-7 has-text-grey">Stations available.</p>
                )}
            </div>

            {/* LEADERBOARD PREVIEW */}
            <Link to="/leaderboard" className="interface-box" style={{ background: 'rgba(0, 209, 178, 0.05)', borderColor: 'rgba(0, 209, 178, 0.2)' }}>
                <p className="is-size-7 has-text-primary is-uppercase mb-3">Top Gamers</p>
                {topGamers.map((p, i) => (
                    <div key={i} className="is-flex is-justify-content-between is-size-7 mb-1">
                        <span className="has-text-grey-light">{i+1}. {p.fullName}</span>
                        <span className="has-text-white">{p.totalHours || 0} Hrs</span>
                    </div>
                ))}
            </Link>

            {/* MEMBER ID CARD */}
            {user && (
                <div className="interface-box has-text-centered">
                    <p className="is-size-7 has-text-grey is-uppercase mb-3">Check-in Pass</p>
                    <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '12px' }}>
                        <QRCode value={JSON.stringify({ uid: user.uid })} size={120} />
                    </div>
                </div>
            )}

            {user && (
                <div className="has-text-centered mt-4">
                    <button onClick={() => signOut(auth)} className="button is-ghost is-small has-text-grey">Log Out</button>
                </div>
            )}
            
            <div style={{ height: '50px' }}></div>
        </div>
    );
};

export default HomePage;