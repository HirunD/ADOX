import React, { useState } from "react";
import { auth, db } from "../../firebase"; 
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";

const SignUpPage = () => {
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        age: "",
        phone: "",
        avatar: "1.png", 
        isVerified: false
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const avatars = ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png"];

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const validateForm = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[0-9]{10}$/;
        if (!formData.fullName.trim()) return "Full name is required.";
        if (!emailRegex.test(formData.email)) return "Please enter a valid email address.";
        if (formData.password.length < 6) return "Password must be at least 6 characters.";
        if (Number(formData.age) <= 0) return "Please enter a valid age.";
        if (formData.phone && !phoneRegex.test(formData.phone)) return "Phone must be 10 digits.";
        if (!formData.isVerified) return "Please check the verification box.";
        return null;
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        const validationError = validateForm();
        if (validationError) { setError(validationError); return; }

        setLoading(true);
        setError("");

        try {
            // 1. Create the Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            await updateProfile(user, { 
                displayName: formData.fullName,
                photoURL: `/avatars/${formData.avatar}`
            });

            // 2. Set User Data in Firestore
            const userRef = doc(db, "users", user.uid);
            const now = new Date();

            await setDoc(userRef, {
                uid: user.uid,
                fullName: formData.fullName,
                email: formData.email,
                age: Number(formData.age),
                phone: formData.phone,
                avatar: formData.avatar,
                sessions: [],
                totalHours: 0,
                createdAt: now.toISOString(),
                rewardClaimed: true, // No pending rewards
                isFirst100: false,
                bonusMinutes: 0
            });

            // Redirect to home
            navigate("/");

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <section className="section" style={{ background: '#050505', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-5">
                        
                        <form className="box" style={{ background: '#111', border: '1px solid #333', color: 'white', borderRadius: '20px' }} onSubmit={handleSignUp} noValidate>
                            <h1 className="title is-4 has-text-white has-text-centered mb-5">Create Player ID</h1>

                            {error && <div className="notification is-danger is-light p-2 is-size-7">{error}</div>}

                            {/* AVATAR SELECTION */}
                            <div className="field mb-5">
                                <label className="label has-text-grey-light is-size-7 has-text-centered">CHOOSE YOUR AVATAR</label>
                                <div className="columns is-multiline is-mobile is-centered mt-2">
                                    {avatars.map((img) => (
                                        <div key={img} className="column is-4-mobile is-4-tablet">
                                            <div 
                                                onClick={() => setFormData({...formData, avatar: img})}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderRadius: '12px',
                                                    padding: '5px',
                                                    border: formData.avatar === img ? '2px solid #00d1b2' : '1px solid #333',
                                                    backgroundColor: formData.avatar === img ? 'rgba(0, 209, 178, 0.1)' : '#1a1a1a',
                                                    transition: '0.3s ease'
                                                }}
                                            >
                                                <figure className="image is-square">
                                                    <img src={`/avatars/${img}`} alt="avatar" style={{ borderRadius: '8px' }} />
                                                </figure>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light is-size-7">FULL NAME</label>
                                <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white', border: '1px solid #333' }} type="text" name="fullName" placeholder="Enter full name" onChange={handleChange} required />
                            </div>

                            <div className="columns is-mobile">
                                <div className="column">
                                    <div className="field">
                                        <label className="label has-text-grey-light is-size-7">AGE</label>
                                        <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white', border: '1px solid #333' }} type="number" name="age" placeholder="Age" onChange={handleChange} required />
                                    </div>
                                </div>
                                <div className="column">
                                    <div className="field">
                                        <label className="label has-text-grey-light is-size-7">PHONE</label>
                                        <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white', border: '1px solid #333' }} type="tel" name="phone" placeholder="10 Digits" onChange={handleChange} />
                                    </div>
                                </div>
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light is-size-7">EMAIL ADDRESS</label>
                                <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white', border: '1px solid #333' }} type="email" name="email" placeholder="email@example.com" onChange={handleChange} required />
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light is-size-7">PASSWORD</label>
                                <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white', border: '1px solid #333' }} type="password" name="password" placeholder="Min 6 chars" onChange={handleChange} required />
                            </div>

                            <div className="field mt-5">
                                <label className="checkbox is-size-7 has-text-grey-light">
                                    <input type="checkbox" name="isVerified" onChange={handleChange} className="mr-2" />
                                    I confirm my details are correct.
                                </label>
                            </div>

                            <button 
                                className={`button is-primary is-fullwidth mt-5 has-text-weight-bold ${loading ? 'is-loading' : ''}`} 
                                type="submit"
                                style={{ 
                                    height: '50px', 
                                    background: '#00d1b2', 
                                    border: 'none', 
                                    color: '#050505',
                                    borderRadius: '10px'
                                }}
                                disabled={!formData.isVerified || loading}
                            >
                                {loading ? 'INITIALIZING...' : 'CREATE PLAYER ID'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SignUpPage;