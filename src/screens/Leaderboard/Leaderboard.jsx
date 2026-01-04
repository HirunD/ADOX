import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";

const Leaderboard = () => {
    const [players, setPlayers] = useState([]);
    const [activeRace, setActiveRace] = useState("Spa - GT3");

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const leaderboardData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.laps) {
                    // Find the best time for THIS specific race for this user
                    const raceLaps = data.laps.filter(l => l.raceName === activeRace);
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
            // Sort overall by fastest time
            setPlayers(leaderboardData.sort((a, b) => a.timeMs - b.timeMs));
        });
        return () => unsubscribe();
    }, [activeRace]);

    return (
        <section className="section" style={{ background: '#050505', minHeight: '100vh', color: 'white' }}>
            <div className="container" style={{ maxWidth: '600px' }}>
                <h1 className="title has-text-white has-text-centered mb-2">🏆 ADOX HALL OF FAME</h1>
                
                <div className="tabs is-centered is-toggle is-toggle-rounded mb-5">
                    <ul style={{border: 'none'}}>
                        <li className={activeRace === "Spa - GT3" ? "is-active" : ""}>
                            <a onClick={() => setActiveRace("Spa - GT3")}>Spa GT3</a>
                        </li>
                        <li className={activeRace === "Monza - F1" ? "is-active" : ""}>
                            <a onClick={() => setActiveRace("Monza - F1")}>Monza F1</a>
                        </li>
                    </ul>
                </div>

                <div className="box" style={{ background: '#121212', border: '1px solid #333', borderRadius: '20px' }}>
                    {players.length > 0 ? (
                        players.map((p, i) => (
                            <div key={i} className="level is-mobile p-3" style={{ borderBottom: i !== players.length-1 ? '1px solid #222' : 'none' }}>
                                <div className="level-left">
                                    <span className="mr-4 has-text-grey-light has-text-weight-bold" style={{ width: '25px' }}>#{i + 1}</span>
                                    <figure className="image is-32x32 mr-3">
                                        <img className="is-rounded" src={`/avatars/${p.avatar || '1.png'}`} />
                                    </figure>
                                    <span className="has-text-weight-semibold">{p.name}</span>
                                </div>
                                <div className="level-right">
                                    <span className="tag is-primary is-medium" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                        {p.time}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="has-text-centered has-text-grey py-5">No records for this track yet.</p>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Leaderboard;