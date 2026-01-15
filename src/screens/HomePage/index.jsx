import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";

const customStyles = `
  body { background-color: #080808; margin: 0; padding: 0; }
  
  /* Main scrollable container */
  .scroll-container {
    height: 100vh;
    overflow-y: auto;
    padding: 20px 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .scroll-container::-webkit-scrollbar { display: none; }

  /* Universal Box Styling */
  .interface-box {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    width: 100%;
    max-width: 400px;
    margin-bottom: 12px;
    padding: 20px;
    box-sizing: border-box;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
    max-width: 400px;
    margin-bottom: 12px;
  }

  .stat-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 15px;
    text-align: center;
  }

  .action-btn {
    width: 100%;
    border: none;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-decoration: none;
  }
`;

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [points, setPoints] = useState(0);
    const [occupiedMachines, setOccupiedMachines] = useState(0);
    const [todaySchedule, setTodaySchedule] = useState([]);
    const TOTAL_MACHINES = 3;

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;
        const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data); 
                const hrs = (data.sessions || []).reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0);
                setPoints(hrs * 2);
            }
        });
        const unsubGlobal = onSnapshot(collection(db, "users"), (snapshot) => {
            let activeCount = 0;
            const schedule = [];
            const now = new Date();
            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions) {
                    data.sessions.forEach(session => {
                        const startTime = new Date(session.startTime);
                        const endTime = new Date(startTime.getTime() + (parseFloat(session.duration) * 60 * 60 * 1000));
                        if (now >= startTime && now < endTime) activeCount++;
                        if (endTime > now) schedule.push({ isMe: user.uid === userDoc.id, start: startTime, end: endTime, machine: session.machine });
                    });
                }
            });
            setTodaySchedule(schedule.sort((a, b) => a.start - b.start));
            setOccupiedMachines(activeCount > TOTAL_MACHINES ? TOTAL_MACHINES : activeCount);
        });
        return () => { unsubUser(); unsubGlobal(); };
    }, [user]);

    if (!user) return null;

    return (
        <div className="scroll-container">
            <style>{customStyles}</style>

            {/* TOP LOGO */}
            <div className="has-text-centered mb-5">
                <img src="/logo.png" alt="Logo" style={{ width: "120px" }} />
            </div>

            {/* USER PROFILE BOX - Now at the top, same size */}
            <div className="interface-box is-flex is-align-items-center is-justify-content-between">
                <div>
                    <p className="has-text-grey is-size-7 is-uppercase mb-1">Active Pilot</p>
                    <h1 className="title is-5 has-text-white mb-0">{userData?.fullName?.split(' ')[0] || 'Guest'}</h1>
                    <p className="is-size-7 has-text-primary">ID: #{user.uid.substring(0, 5).toUpperCase()}</p>
                </div>
                <figure className="image is-48x48">
                    <img className="is-rounded" src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"} style={{ border: '2px solid #00d1b2' }} alt="profile" />
                </figure>
            </div>

            {/* LEADERBOARD BOX */}
            <Link to="/leaderboard" className="interface-box action-btn" style={{ background: 'linear-gradient(135deg, rgba(0, 209, 178, 0.2), transparent)' }}>
                <div>
                    <p className="title is-6 has-text-white mb-1">LEADERBOARD</p>
                    <p className="is-size-7 has-text-primary">VIEW RANKINGS →</p>
                </div>
                <i className="fas fa-trophy fa-lg has-text-white" style={{ opacity: 0.5 }}></i>
            </Link>

            {/* STATS ROW (SLOTS & POINTS) */}
            <div className="stat-grid">
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">FREE SLOTS</p>
                    <p className="is-size-3 has-text-weight-bold has-text-success">{TOTAL_MACHINES - occupiedMachines}</p>
                </div>
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">XP POINTS</p>
                    <p className="is-size-3 has-text-weight-bold has-text-white">{points}</p>
                </div>
            </div>

            {/* MEMBER QR BOX */}
            <div className="interface-box has-text-centered">
                <p className="is-size-7 has-text-grey is-uppercase mb-3">Identity Pass</p>
                <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '12px' }}>
                    <QRCode value={JSON.stringify({ uid: user.uid })} size={140} />
                </div>
            </div>

            {/* TRACK ACTIVITY BOX */}
            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3">Track Activity</p>
                {todaySchedule.length > 0 ? (
                    <div className="is-flex is-justify-content-between is-align-items-center">
                        <p className="is-size-7 has-text-white">Active session running</p>
                        <span className="tag is-black is-rounded is-small" style={{ border: '1px solid #333' }}>{todaySchedule[0].machine}</span>
                    </div>
                ) : (
                    <p className="is-size-7 has-text-grey">No active bookings</p>
                )}
            </div>

            {/* SIGN OUT BOX - Same size and style as others */}
            <div className="interface-box action-btn" onClick={() => signOut(auth)} style={{ cursor: 'pointer', border: '1px solid rgba(255, 56, 96, 0.3)' }}>
                <div>
                    <p className="title is-6 has-text-danger mb-1">SIGN OUT</p>
                    <p className="is-size-7 has-text-danger" style={{ opacity: 0.7 }}>TERMINATE SESSION</p>
                </div>
                <i className="fas fa-sign-out-alt fa-lg has-text-danger" style={{ opacity: 0.5 }}></i>
            </div>
            
            {/* Bottom spacer for clean scrolling */}
            <div style={{ height: '40px' }}></div>
        </div>
    );
};

export default HomePage;