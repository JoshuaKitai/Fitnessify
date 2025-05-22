import React, { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function ProgressTracker() {
    const [formData, setFormData] = useState({
        person_weight: '',
        bench: '',
        squat: '',
        dead_lift: ''
    });

    const [progressEntries, setProgressEntries] = useState([]);
    const [deleteEntryId, setDeleteEntryId] = useState(null);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const fetchProgressEntries = async () => {
        const res = await fetch('http://localhost:5000/progress');
        const data = await res.json();
        setProgressEntries(data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('http://localhost:5000/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                person_weight: parseFloat(formData.person_weight),
                bench: parseFloat(formData.bench),
                squat: parseFloat(formData.squat),
                dead_lift: parseFloat(formData.dead_lift)
            })
        });

        if (res.ok) {
            setFormData({ person_weight: '', bench: '', squat: '', dead_lift: '' });
            fetchProgressEntries();
        } else {
            alert("Failed to add entry.");
        }
    };

    const confirmDelete = async (id) => {
        const res = await fetch(`http://localhost:5000/progress/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            fetchProgressEntries();
        } else {
            alert("Failed to delete entry.");
        }

        setDeleteEntryId(null);
    };

    useEffect(() => {
        fetchProgressEntries();
    }, []);

    const sortedEntries = [...progressEntries].sort((a, b) => new Date(a.date) - new Date(b.date));

    return (
        <div className='progress-tracker'>
            <h1>Gym Progress</h1>

            <form onSubmit={handleSubmit}>
                <input type="number" name="person_weight" placeholder="Weight" value={formData.person_weight} onChange={handleChange} required />
                <input type="number" name="bench" placeholder="Bench Press" value={formData.bench} onChange={handleChange} required />
                <input type="number" name="squat" placeholder="Squat" value={formData.squat} onChange={handleChange} required />
                <input type="number" name="dead_lift" placeholder="Deadlift" value={formData.dead_lift} onChange={handleChange} required />
                <button type="submit">Submit Progress</button>
            </form>

            <h2>Progress Entries</h2>
            {progressEntries.length === 0 ? (
                <p>No progress entries yet.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Weight (lbs)</th>
                            <th>Bench</th>
                            <th>Squat</th>
                            <th>Deadlift</th>
                            <th>Delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        {progressEntries.map(entry => (
                            <tr key={entry.id}>
                                <td>{new Date(entry.date + "T12:00:00").toLocaleDateString()}</td>
                                <td>{entry.person_weight}</td>
                                <td>{entry.bench}</td>
                                <td>{entry.squat}</td>
                                <td>{entry.dead_lift}</td>
                                <td>
                                    <button onClick={() => setDeleteEntryId(entry.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {deleteEntryId !== null && (
                <div style={{
                    position: 'fixed',
                    right: 0,
                    top: 0,
                    width: '300px',
                    height: '100%',
                    backgroundColor: '#f8f8f8',
                    borderLeft: '1px solid #ddd',
                    padding: '20px',
                    boxShadow: '-2px 0 5px rgba(0,0,0,0.1)'
                }}>
                    <h3>Confirm Delete</h3>
                    <p>Are you sure you want to delete this progress entry?</p>
                    <button onClick={() => confirmDelete(deleteEntryId)} style={{ marginRight: '10px' }}>Yes, Delete</button>
                    <button onClick={() => setDeleteEntryId(null)}>Cancel</button>
                </div>
            )}

            <h3>Progress Over Time (Interactive)</h3>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={sortedEntries} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="person_weight" name="Weight" stroke="#8884d8" />
                    <Line type="monotone" dataKey="bench" name="Bench" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="squat" name="Squat" stroke="#ffc658" />
                    <Line type="monotone" dataKey="dead_lift" name="Deadlift" stroke="#ff8042" />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default ProgressTracker;
