import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";

const customStyles = `
  @keyframes pulse-gold {
    0% { box-shadow: 0 0 0 0 rgba(0, 209, 178, 0.4); transform: scale(1); }
    70% { box-shadow: 0 0 0 10px rgba(0, 209, 178, 0); transform: scale(1.02); }
    100% { box-shadow: 0 0 0 0 rgba(0, 209, 178, 0); transform: scale(1); }
  }

  .itinerary-scroll::-webkit-scrollbar { width: 4px; }
  .itinerary-scroll::-webkit-scrollbar-track { background: #121212; }
  .itinerary-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
  
  .masonry-grid {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  @media (min-width: 1024px) {
    .masonry-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: min-content;
      gap: 1.5rem;
    }
    .span-2 { grid-column: span 2; }
  }

  .tile-card {
    transition: transform 0.3s ease, border-color 0.3s ease;
  }
  .tile-card:hover {
    transform: translateY(-5px);
    border-color: #00d1b2 !important;
  }
`;

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [points, setPoints] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [occupiedMachines, setOccupiedMachines] = useState(0);
    const [todaySchedule, setTodaySchedule] = useState([]);
    const TOTAL_MACHINES = 3;

    const avatars = ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png"];

    const formatMachineName = (name) => {
        const val = String(name).trim();
        if (val === "1" || val === "Sim" || val === "Sim Rig") return "Sim Rig";
        if (val === "2" || val === "PC1" || val === "PS4 #1") return "PS4 #1";
        if (val === "3" || val === "PC2" || val === "PS4 #2") return "PS4 #2";
        return val;
    };

    const handleLogout = async () => {
        try { await signOut(auth); } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            let activeCount = 0;
            const schedule = [];
            const now = new Date();
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            
            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions) {
                    data.sessions.forEach(session => {
                        const startTime = new Date(session.startTime);
                        const endTime = new Date(startTime.getTime() + (parseFloat(session.duration) * 60 * 60 * 1000) + 600000);
                        
                        if (now >= startTime && now < endTime) activeCount++;

                        if (endTime > now && startTime >= startOfToday) {
                            schedule.push({
                                isMe: auth.currentUser?.uid === userDoc.id,
                                start: startTime,
                                end: endTime,
                                machine: formatMachineName(session.machine),
                                active: now >= startTime && now < endTime
                            });
                        }
                    });
                }
            });
            setTodaySchedule(schedule.sort((a, b) => a.start - b.start));
            setOccupiedMachines(activeCount > TOTAL_MACHINES ? TOTAL_MACHINES : activeCount);
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data); 
                    const hrs = (data.sessions || []).reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0);
                    setPoints(hrs * 2);
                }
            });
            return () => unsubscribe();
        }
    }, [user]);

    const changeAvatar = async (img) => {
        if (!user) return;
        await updateDoc(doc(db, "users", user.uid), { avatar: img });
        setShowSettings(false);
    };

    // --- SHARED COMPONENTS ---
    const StatusTile = () => (
        <div className="box tile-card" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '24px' }}>
            <p className="heading has-text-grey">Live Slots</p>
            <div className="has-text-centered py-4">
                <p className={`title is-1 ${occupiedMachines < TOTAL_MACHINES ? 'has-text-success' : 'has-text-danger'}`}>
                    {TOTAL_MACHINES - occupiedMachines}
                </p>
                <p className="is-size-7 has-text-grey">FREE STATIONS</p>
            </div>
            <div className="is-flex is-justify-content-center mt-2">
                {[...Array(TOTAL_MACHINES)].map((_, i) => (
                    <div key={i} style={{
                        width: '10px', height: '10px', borderRadius: '50%', margin: '0 5px',
                        background: i < occupiedMachines ? '#ff3860' : '#00d1b2',
                        boxShadow: i < occupiedMachines ? '0 0 8px #ff3860' : '0 0 8px #00d1b2'
                    }}></div>
                ))}
            </div>
        </div>
    );

  const ItineraryTile = ({ isSpan2 }) => (
        <div className={`box tile-card ${isSpan2 ? 'span-2' : ''}`} style={{ background: '#121212', border: '1px solid #222', borderRadius: '24px' }}>
            <p className="label has-text-grey is-size-7 mb-4">LIVE TRACK SCHEDULE</p>
            <div className="itinerary-scroll" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {todaySchedule.length > 0 ? todaySchedule.map((item, idx) => (
                    <div key={idx} className="mb-2 p-3 is-flex is-justify-content-between is-align-items-center" 
                        style={{ 
                            background: '#1a1a1a', 
                            borderRadius: '15px',
                            border: item.isMe ? '1px solid #00d1b2' : 'none' // Highlights your session
                        }}>
                        <div>
                            <p className="is-size-7 has-text-white has-text-weight-bold">
                                {item.isMe ? "★ MY SESSION" : (item.active ? "● IN PROGRESS" : "UPCOMING")}
                            </p>
                            <p className="is-size-7 has-text-grey">Ends: {item.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <span className={`tag is-rounded is-small ${item.active ? 'is-success' : 'is-dark'}`} style={{ minWidth: '90px' }}>
                            {item.machine}
                        </span>
                    </div>
                )) : <p className="has-text-centered has-text-grey is-size-7">No active bookings</p>}
            </div>
        </div>
    );
    // --- PUBLIC SIGNED-OUT VIEW ---
    if (!user) {
        return (
            <section className="section" style={{ background: '#050505', minHeight: '100vh', padding: '1.5rem' }}>
                <style>{customStyles}</style>
                <div className="container">
                    <div className="has-text-centered mb-6">
                        <h1 className="title is-3 has-text-white mb-2">ADOX GAMING</h1>
                        <p className="subtitle is-6 has-text-primary">Experience the Ultimate Rig</p>
                    </div>

                    <div className="masonry-grid">
                        <StatusTile />
                        
                        <div className="span-2">
                             <Link to="/login" className="box tile-card" style={{ background: 'linear-gradient(135deg, #00d1b2 0%, #008f7a 100%)', borderRadius: '24px', animation: 'pulse-gold 2s infinite' }}>
                                <div className="is-flex is-justify-content-between is-align-items-center py-2">
                                    <span>
                                        <p className="title is-4 has-text-white mb-1">JOIN THE RACE</p>
                                        <p className="subtitle is-7 has-text-white">LOGIN TO YOUR PASS →</p>
                                    </span>
                                    <i className="fas fa-id-card fa-3x has-text-white" style={{ opacity: 0.4 }}></i>
                                </div>
                            </Link>
                        </div>

                        <ItineraryTile isSpan2={true} />

                        <Link to="/leaderboard" className="box tile-card" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '24px' }}>
                            <div className="has-text-centered">
                                <i className="fas fa-trophy fa-2x has-text-warning mb-2"></i>
                                <p className="title is-6 has-text-white">LEADERBOARD</p>
                                <p className="is-size-7 has-text-grey">View Fastest Laps</p>
                            </div>
                        </Link>

                        <Link to="/login" className="box tile-card span-2" style={{ background: '#121212', border: '1px dashed #444', borderRadius: '24px' }}>
                            <div className="has-text-centered py-3">
                                <p className="title is-6 has-text-white">New Player?</p>
                                <p className="is-size-7 has-text-grey">Click here to register and start earning points!</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    // --- PRIVATE SIGNED-IN VIEW ---
    return (
        <section className="section" style={{ background: '#050505', minHeight: '100vh', padding: '1rem' }}>
            <style>{customStyles}</style>
            <div className="container">
                
                {/* HEADER */}
                <div className="is-flex is-justify-content-between is-align-items-center mb-6 mt-2">
                    <div>
                        <h1 className="title is-4 has-text-white mb-0">Hi, {userData?.fullName?.split(' ')[0]}</h1>
                        <p className="is-size-7 has-text-primary">DRIVER ID: #{user.uid.substring(0, 5).toUpperCase()}</p>
                    </div>
                    <figure className="image is-48x48" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>
                        <img className="is-rounded" src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"} style={{ border: '2px solid #00d1b2' }} alt="profile" />
                    </figure>
                </div>

                <div className="masonry-grid">
                    <div className="span-2">
                        <Link to="/leaderboard">
                            <div className="box tile-card" style={{ background: 'linear-gradient(135deg, #00d1b2 0%, #008f7a 100%)', borderRadius: '24px', animation: 'pulse-gold 2s infinite' }}>
                                <div className="is-flex is-justify-content-between is-align-items-center">
                                    <span>
                                        <p className="title is-4 has-text-white mb-0">LEADERBOARD</p>
                                        <p className="subtitle is-7 has-text-white">VIEW RANKINGS →</p>
                                    </span>
                                    <i className="fas fa-flag-checkered fa-3x has-text-white" style={{ opacity: 0.4 }}></i>
                                </div>
                            </div>
                        </Link>
                    </div>

                    <StatusTile />

                    <div className="box tile-card has-text-centered" style={{ background: '#121212', border: '1px solid #222', borderRadius: '24px' }}>
                        <p className="label has-text-grey is-size-7 mb-4">MEMBER QR</p>
                        <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '15px' }}>
                            <QRCode value={JSON.stringify({ uid: user.uid })} size={140} />
                        </div>
                    </div>

                    <ItineraryTile isSpan2={true} />

                    <div className="box tile-card" style={{ background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)', border: '1px solid #00d1b244', borderRadius: '24px' }}>
                        <p className="heading has-text-grey-light">Points</p>
                        <p className="title is-2 has-text-white mb-0">{points}</p>
                        <div className="is-size-7 has-text-primary mt-2">Level Up Soon</div>
                    </div>
                </div>

                <div className="mt-6 mb-6 px-4">
                    <button className="button is-danger is-outlined is-fullwidth" onClick={handleLogout} style={{ borderRadius: '15px', height: '60px', fontWeight: 'bold', fontSize: '1.2rem', borderWidth: '2px' }}>
                        SIGN OUT
                    </button>
                </div>
            </div>

            {/* AVATAR MODAL */}
            {showSettings && (
                <div className="modal is-active">
                    <div className="modal-background" onClick={() => setShowSettings(false)}></div>
                    <div className="modal-content px-4">
                        <div className="box" style={{ background: '#1a1a1a', borderRadius: '24px', border: '1px solid #00d1b2' }}>
                            <p className="title is-5 has-text-white mb-5">Select Character</p>
                            <div className="columns is-multiline is-mobile">
                                {avatars.map(img => (
                                    <div key={img} className="column is-4">
                                        <img src={`/avatars/${img}`} className="is-rounded" onClick={() => changeAvatar(img)} style={{ cursor: 'pointer', border: userData?.avatar === img ? '2px solid #00d1b2' : 'none' }} alt="option" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default HomePage;