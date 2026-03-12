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
    });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const avatars = ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png"];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[0-9]{10}$/;

        if (!formData.fullName.trim()) return "Full name is required.";
        if (Number(formData.age) <= 0) return "Please enter a valid age.";
        if (formData.password.length < 6) return "Password must be at least 6 characters.";
        if (!formData.email && !formData.phone) return "Either Email or Phone is required.";
        
        if (formData.email && !emailRegex.test(formData.email)) return "Invalid email format.";
        if (formData.phone && !phoneRegex.test(formData.phone)) return "Phone must be 10 digits.";
        
        return null;
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        const validationError = validateForm();
        if (validationError) { setError(validationError); return; }

        setLoading(true);
        setError("");

        // LOGIC: Use email if provided, otherwise use phone-shadow-email
        const authEmail = formData.email ? formData.email : `${formData.phone}@adox.com`;

        try {
            // 1. Create Auth Account with Password (No OTP needed)
            const res = await createUserWithEmailAndPassword(auth, authEmail, formData.password);
            const user = res.user;

            // 2. Update Profile (Name & Avatar)
            await updateProfile(user, { 
                displayName: formData.fullName,
                photoURL: `/avatars/${formData.avatar}`
            });

            // 3. Store in Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                fullName: formData.fullName,
                email: formData.email || null,
                phone: formData.phone || null,
                avatar: formData.avatar,
                sessions: [],
                totalHours: 0,
                createdAt: new Date().toISOString(),
                rewardClaimed: true,
                bonusMinutes: 0
            });

            navigate("/");
        } catch (err) {
            if (err.code === "auth/email-already-in-use") {
                setError("This phone or email is already registered.");
            } else {
                setError(err.message);
            }
            setLoading(false);
        }
    };

    return (
        <section className="section" style={{ background: '#050505', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-5">
                        <form className="box" style={{ background: '#111', border: '1px solid #333', color: 'white', borderRadius: '20px' }} onSubmit={handleSignUp}>
                            <h1 className="title is-4 has-text-white has-text-centered mb-5">Create Player ID</h1>
                            
                            {error && <div className="notification is-danger is-light p-2 is-size-7">{error}</div>}

                            {/* BIGGER AVATAR SELECTION */}
                            <div className="field mb-5">
                                <label className="label has-text-grey-light is-size-7 has-text-centered">CHOOSE YOUR AVATAR</label>
                                <div className="columns is-multiline is-mobile is-centered mt-2">
                                    {avatars.map((img) => (
                                        <div key={img} className="column is-6-mobile is-4-tablet" onClick={() => setFormData({...formData, avatar: img})}>
                                            <div style={{ 
                                                cursor: 'pointer', 
                                                borderRadius: '15px', 
                                                padding: '10px', 
                                                border: formData.avatar === img ? '3px solid #00d1b2' : '1px solid #333', 
                                                backgroundColor: formData.avatar === img ? 'rgba(0, 209, 178, 0.1)' : '#1a1a1a',
                                                transition: '0.3s ease'
                                            }}>
                                                <figure className="image is-square">
                                                    <img src={`/avatars/${img}`} alt="avatar" style={{ borderRadius: '10px' }} />
                                                </figure>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light is-size-7">FULL NAME</label>
                                <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white' }} type="text" name="fullName" placeholder="Full Name" onChange={handleChange} />
                            </div>

                            <div className="columns is-mobile">
                                <div className="column is-4">
                                    <label className="label has-text-grey-light is-size-7">AGE</label>
                                    <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white' }} type="number" name="age" placeholder="Age" onChange={handleChange} />
                                </div>
                                <div className="column">
                                    <label className="label has-text-grey-light is-size-7">PHONE NUMBER</label>
                                    <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white' }} type="tel" name="phone" placeholder="07XXXXXXXX" onChange={handleChange} />
                                </div>
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light is-size-7">EMAIL ADDRESS (OPTIONAL)</label>
                                <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white' }} type="email" name="email" placeholder="email@example.com" onChange={handleChange} />
                            </div>

                            <div className="field">
                                <label className="label has-text-grey-light is-size-7">SET PASSWORD</label>
                                <input className="input is-dark" style={{ background: '#1a1a1a', color: 'white' }} type="password" name="password" placeholder="Min 6 characters" onChange={handleChange} />
                            </div>

                            <button className={`button is-primary is-fullwidth mt-5 has-text-weight-bold ${loading ? 'is-loading' : ''}`} type="submit" style={{ height: '50px' }}>
                                INITIALIZE PLAYER ID
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SignUpPage;