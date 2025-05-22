import React, { useEffect, useState } from 'react';
import './App.css';
import CalorieTracker from './CalorieTracker';
import ProgressTracker from './Progress';
import CalendarHistory from './CalendarHistory';

function App() {
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch('http://localhost:5000/')
            .then(res => res.json())
            .then(data => setMessage(data.message));
    }, []);

    return (
        <div className="app">
            <div className="navbar">
                <div className="logo">Fitnessify</div>
                <h1 className="header-title">{message}</h1>
                <div className="date">{new Date().toLocaleDateString()}</div>
            </div>


            <div className="content-row">
                <div className="content-left">
                    <CalorieTracker />
                </div>
                <div className="content-right">
                    <ProgressTracker />
                </div>
            </div>
            <div>
                <CalendarHistory />
            </div>
        </div>
    );
}

export default App;
