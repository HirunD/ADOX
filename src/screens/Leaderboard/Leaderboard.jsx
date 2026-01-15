import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";

const customStyles = `
  body { background-color: #080808; margin: 0; padding: 0; }
  
  .scroll-container {
    height: 100vh;
    overflow-y: auto;
    padding: 20px 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .scroll-container::-webkit-scrollbar { display: none; }

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

  .rank-badge {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 12px;
    font-weight: bold;
    margin-right: 12px;
  }

  .gold { background: #ffd700; color: #000; }
  .silver { background: #c0c0c0; color: #000; }
  .bronze { background: #cd7f32; color: #000; }
  .default-rank { background: rgba(255,255,255,0.1); color: #fff; }
`;

const Leaderboard = () => {
    const [players, setPlayers] = useState([]);
    // Removed the toggle state since we only have one competition now
    const ACTIVE_RACE = "Spa - GT3";

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const leaderboardData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.laps) {
                    const raceLaps = data.laps.filter(l => l.raceName === ACTIVE_RACE);
                    if (raceLaps.length > 0) {
                        const bestLap = raceLaps.sort((a, b) => a.timeMs - b.timeMs)[0];
                        leaderboardData.push({
                            name: data.fullName,
                            avatar: data.avatar,
                            time: bestLap.timeStr,
                            timeMs: bestLap.timeMs
                        });
                    }
                }
            });
            setPlayers(leaderboardData.sort((a, b) => a.timeMs - b.timeMs));
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="scroll-container">
            <style>{customStyles}</style>

            {/* TOP NAVIGATION / LOGO */}
            <div className="is-flex is-align-items-center is-justify-content-between w-100 mb-5" style={{ width: '100%', maxWidth: '400px' }}>
                <Link to="/" style={{ color: 'white' }}>
                    <i className="fas fa-chevron-left mr-2"></i> Back
                </Link>
                <img src="/logo.png" alt="Logo" style={{ width: "80px" }} />
                <div style={{ width: '45px' }}></div> {/* Spacer for symmetry */}
            </div>

            {/* HEADER BOX */}
            <div className="interface-box" style={{ background: 'linear-gradient(135deg, rgba(0, 209, 178, 0.2), transparent)' }}>
                <p className="has-text-grey is-size-7 is-uppercase mb-1">Current Circuit</p>
                <h1 className="title is-4 has-text-white mb-1">SPA-FRANCORCHAMPS</h1>
                <p className="is-size-7 has-text-primary has-text-weight-bold">CLASS: GT3</p>
            </div>

            {/* LEADERBOARD ENTRIES */}
            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-4">Fastest Laps</p>
                
                {players.length > 0 ? (
                    players.map((p, i) => (
                        <div key={i} className="is-flex is-align-items-center is-justify-content-between mb-4">
                            <div className="is-flex is-align-items-center">
                                {/* Rank Circles */}
                                <div className={`rank-badge ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default-rank'}`}>
                                    {i + 1}
                                </div>
                                
                                <figure className="image is-32x32 mr-3">
                                    <img className="is-rounded" src={`/avatars/${p.avatar || '1.png'}`} style={{ border: '1px solid rgba(255,255,255,0.2)' }} alt="avatar"/>
                                </figure>
                                
                                <span className="has-text-white is-size-6 has-text-weight-semibold">
                                    {p.name.split(' ')[0]}
                                </span>
                            </div>
                            
                            <div className="has-text-right">
                                <p className="is-family-monospace has-text-primary has-text-weight-bold is-size-6">
                                    {p.time}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="has-text-centered has-text-grey is-size-7 py-5">Record clear. Be the first to set a time!</p>
                )}
            </div>

            {/* INFO BOX */}
            <div className="interface-box" style={{ borderStyle: 'dashed' }}>
                <p className="is-size-7 has-text-grey has-text-centered">
                    Top 3 drivers receive bonus points at the end of the month.
                </p>
            </div>

            <div style={{ height: '40px' }}></div>
        </div>
    );
};

export default Leaderboard;