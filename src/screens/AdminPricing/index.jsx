import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";

const AdminPricing = () => {
    const [config, setConfig] = useState({ isPeak: false, standard: {}, peak: {} });
    const [editConfig, setEditConfig] = useState({ isPeak: false, standard: {}, peak: {} });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const standardDocRef = doc(db, "settings", "pricing");
        const peakDocRef = doc(db, "settings", "peak");

        // 1. Fetch Standard Pricing (handles flat structure)
        const unsubStandard = onSnapshot(standardDocRef, (snap) => {
            if (snap.exists()) {
                const rawData = snap.data();
                const isPeakVal = rawData.isPeak ?? false;
                
                // Filter: Take everything EXCEPT the 'isPeak' boolean
                const standardOnly = {};
                Object.keys(rawData).forEach(key => {
                    if (key !== 'isPeak') {
                        standardOnly[key] = rawData[key];
                    }
                });
                
                setConfig(prev => ({ ...prev, isPeak: isPeakVal, standard: standardOnly }));
                setEditConfig(prev => ({ ...prev, isPeak: isPeakVal, standard: standardOnly }));
            }
        });

        // 2. Fetch Peak Pricing (separate doc)
        const unsubPeak = onSnapshot(peakDocRef, (snap) => {
            if (snap.exists()) {
                const peakData = snap.data();
                setConfig(prev => ({ ...prev, peak: peakData }));
                setEditConfig(prev => ({ ...prev, peak: peakData }));
            }
            setLoading(false);
        });

        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => { unsubStandard(); unsubPeak(); clearInterval(timer); };
    }, []);

    // 1:00 PM (780m) to 3:30 PM (930m)
    const isCurrentlyPeak = () => {
        if (config.isPeak === true) return true;
        const totalMinutes = (currentTime.getHours() * 60) + currentTime.getMinutes();
        return (totalMinutes >= 780 && totalMinutes <= 930);
    };

    const togglePeak = async () => {
        await updateDoc(doc(db, "settings", "pricing"), { isPeak: !config.isPeak });
    };

    const handleInputChange = (type, hours, val) => {
        setEditConfig(prev => ({
            ...prev,
            [type]: { ...prev[type], [hours]: val === '' ? '' : Number(val) }
        }));
    };

    const saveToDatabase = async () => {
        setIsSaving(true);
        try {
            // Save flat structure back to 'pricing'
            await updateDoc(doc(db, "settings", "pricing"), {
                ...editConfig.standard,
                isPeak: editConfig.isPeak
            });

            // Save to 'peak'
            await updateDoc(doc(db, "settings", "peak"), editConfig.peak);
            alert("Pricing updated!");
        } catch (err) {
            console.error(err);
            alert("Save failed");
        }
        setIsSaving(false);
    };

    if (loading) return <div className="section has-text-centered"><div className="button is-loading is-ghost">Loading...</div></div>;

    return (
        <div className="section" style={{ background: '#050505', minHeight: '100vh', color: 'white' }}>
            <div className="container" style={{ maxWidth: '800px' }}>
                
                {/* STATUS BAR */}
                <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                    <div className="level is-mobile">
                        <div className="level-left">
                            <div>
                                <h1 className="title is-4 has-text-white">Pricing Control</h1>
                                <p className={isCurrentlyPeak() ? "has-text-danger" : "has-text-success"}>
                                    {isCurrentlyPeak() ? "🔥 PEAK ACTIVE" : "🟢 STANDARD ACTIVE"}
                                </p>
                            </div>
                        </div>
                        <div className="level-right">
                            <button className={`button is-rounded ${config.isPeak ? 'is-danger' : 'is-dark'}`} onClick={togglePeak}>
                                {config.isPeak ? "FORCE PEAK: ON" : "MANUAL PEAK: OFF"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="columns">
                    {/* STANDARD COLUMN */}
                    <div className="column is-6">
                        <div className="box" style={{ background: '#111', border: '1px solid #222' }}>
                            <h3 className="has-text-primary mb-4">Standard Rates</h3>
                            {Object.keys(editConfig.standard).sort().map(h => (
                                <div className="field is-horizontal mb-4" key={h}>
                                    <label className="label has-text-grey-light is-small" style={{ width: '80px' }}>{h} Hr</label>
                                    <input className="input is-dark is-small" type="number" value={editConfig.standard[h]} onChange={(e) => handleInputChange('standard', h, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PEAK COLUMN */}
                    <div className="column is-6">
                        <div className="box" style={{ background: '#111', border: '1px solid #222' }}>
                            <h3 className="has-text-danger mb-4">Peak Rates</h3>
                            {Object.keys(editConfig.peak).sort().map(h => (
                                <div className="field is-horizontal mb-4" key={h}>
                                    <label className="label has-text-grey-light is-small" style={{ width: '80px' }}>{h} Hr</label>
                                    <input className="input is-dark is-small" type="number" value={editConfig.peak[h]} onChange={(e) => handleInputChange('peak', h, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <button 
                    className={`button is-primary is-fullwidth ${isSaving ? 'is-loading' : ''}`} 
                    onClick={saveToDatabase}
                    disabled={JSON.stringify(config) === JSON.stringify(editConfig)}
                >
                    SAVE ALL CHANGES
                </button>
            </div>
        </div>
    );
};

export default AdminPricing;