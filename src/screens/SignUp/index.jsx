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
        school: "",
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
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            await updateProfile(user, { 
                displayName: formData.fullName,
                photoURL: `/avatars/${formData.avatar}`
            });

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                fullName: formData.fullName,
                email: formData.email,
                age: Number(formData.age),
                school: formData.school,
                phone: formData.phone,
                avatar: formData.avatar,
                sessions: [],
                createdAt: new Date().toISOString()
            });

            navigate("/"); 
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="section" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-5">
                        <form className="box" style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }} onSubmit={handleSignUp} noValidate>
                            <h1 className="title has-text-white has-text-centered mb-5">Create Player Account</h1>

                            {error && <div className="notification is-danger is-light p-2 is-size-7">{error}</div>}

                            {/* AVATAR SELECTION GRID */}
                            <div className="field mb-5">
                                <label className="label has-text-grey-light has-text-centered">Select Your Avatar</label>
                                <div className="columns is-multiline is-mobile is-centered mt-2">
                                    {avatars.map((img) => (
                                        <div key={img} className="column is-4-mobile is-4-tablet">
                                            <div 
                                                onClick={() => setFormData({...formData, avatar: img})}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderRadius: '12px',
                                                    padding: '8px',
                                                    border: formData.avatar === img ? '3px solid #00d1b2' : '1px solid #444',
                                                    transition: 'all 0.2s ease',
                                                    backgroundColor: formData.avatar === img ? '#00d1b222' : '#252525',
                                                    transform: formData.avatar === img ? 'scale(1.05)' : 'scale(1)'
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
                                <label className="label has-text-grey-light">Full Name</label>
                                <input className="input is-dark" style={{ background: '#252525', color: 'white', border: '1px solid #444' }} type="text" name="fullName" placeholder="Enter full name" onChange={handleChange} required />
                            </div>

                            <div className="columns">
                                <div className="column">
                                    <div className="field">
                                        <label className="label has-text-grey-light">Age</label>
                                        <input className="input is-dark" style={{ background: '#252525', color: 'white', border: '1px solid #444' }} type="number" name="age" placeholder="Age" onChange={handleChange} required />
                                    </div>
                                </div>
                                <div className="column">
                                    <div className="field">
                                        <label className="label has-text-grey-light">Phone</label>
                                        <input className="input is-dark" style={{ background: '#252525', color: 'white', border: '1px solid #444' }} type="tel" name="phone" placeholder="10 Digits" onChange={handleChange} />
                                    </div>
                                </div>
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light">Email Address</label>
                                <input className="input is-dark" style={{ background: '#252525', color: 'white', border: '1px solid #444' }} type="email" name="email" placeholder="email@example.com" onChange={handleChange} required />
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light">Password</label>
                                <input className="input is-dark" style={{ background: '#252525', color: 'white', border: '1px solid #444' }} type="password" name="password" placeholder="Min 6 chars" onChange={handleChange} required />
                            </div>

                            <div className="field mt-4">
                                <label className="checkbox has-text-grey-light">
                                    <input type="checkbox" name="isVerified" onChange={handleChange} className="mr-2" />
                                    I confirm my details are correct.
                                </label>
                            </div>

                            <button 
                                className={`button is-primary is-fullwidth mt-5 has-text-weight-bold ${loading ? 'is-loading' : ''}`} 
                                type="submit"
                                style={{ height: '50px' }}
                                disabled={!formData.isVerified || loading}
                            >
                                START GAMING
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SignUpPage;