// src/CalendarHistory.js
import React, { useState, useEffect } from 'react';
import './CalendarHistory.css';

function CalendarHistory() {
    const [weekOptions, setWeekOptions] = useState([]);
    const [weekStart, setWeekStart] = useState(null);
    const [selectedWeekStartStr, setSelectedWeekStartStr] = useState('');
    const [weekDates, setWeekDates] = useState([]);
    const [entriesByDay, setEntriesByDay] = useState({});
    const [progressByDay, setProgressByDay] = useState({});

    // Create list of week start dates from Jan 2025 to now
    useEffect(() => {
        const startDate = new Date('2025-01-01');
        const today = new Date();
        const weeks = [];

        let current = new Date(startDate);
        current.setDate(current.getDate() - current.getDay()); // Align to Sunday

        while (current <= today) {
            weeks.push(new Date(current));
            current.setDate(current.getDate() + 7);
        }

        setWeekOptions(weeks.reverse());

        // Set default to current week's Sunday
        const currentSunday = new Date();
        currentSunday.setDate(currentSunday.getDate() - currentSunday.getDay());
        const currentSundayStr = currentSunday.toISOString().split('T')[0];

        const matched = weeks.find(week => week.toISOString().split('T')[0] === currentSundayStr);
        if (matched) {
            setWeekStart(matched);
            setSelectedWeekStartStr(matched.toISOString());
        }
    }, []);

    // When week changes, update dates
    useEffect(() => {
        if (!weekStart) return;

        const week = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            return date;
        });

        setWeekDates(week);
        const fetchData = async () => {
            for (let date of week) {
                const dateStr = date.toISOString().split('T')[0];
                const resEntries = await fetch(`http://localhost:5000/entries/${dateStr}`);
                const resProgress = await fetch(`http://localhost:5000/progress/${dateStr}`);
                const dataEntries = await resEntries.json();
                const dataProgress = await resProgress.json();

                setEntriesByDay(prev => ({ ...prev, [dateStr]: dataEntries }));
                setProgressByDay(prev => ({ ...prev, [dateStr]: dataProgress }));
            }
        };
        fetchData();
    }, [weekStart]);

    const getTotals = (entries) => {
        return entries.reduce((acc, e) => ({
            calories: acc.calories + e.calories,
            protein: acc.protein + e.protein,
            carbs: acc.carbs + e.carbs,
            fat: acc.fat + e.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    };

    return (
        <div className="calendar-history" style={{ overflowX: 'auto' }}>
            <h2>Weekly Nutrition & Progress</h2>
            <label>Select a Week: </label>
            <select
                value={selectedWeekStartStr}
                onChange={(e) => {
                    const newStr = e.target.value;
                    setSelectedWeekStartStr(newStr);
                    setWeekStart(new Date(newStr));
                }}
            >
                {weekOptions.map(date => (
                    <option key={date.toISOString()} value={date.toISOString()}>
                        Week of {date.toLocaleDateString()}
                    </option>
                ))}
            </select>

            <div className="week-grid">
                {weekDates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const entries = entriesByDay[dateStr] || [];
                    const progress = progressByDay[dateStr] || [];
                    const totals = getTotals(entries);

                    return (
                        <div className="day-cell" key={dateStr}>
                            <h3>{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h3>

                            <div className="hover-box macro-box">
                                Macronutrients
                                <div className="hover-content">
                                    <strong>Calories:</strong> {totals.calories.toFixed(1)} kcal<br />
                                    Protein: {totals.protein.toFixed(1)}g<br />
                                    Carbs: {totals.carbs.toFixed(1)}g<br />
                                    Fat: {totals.fat.toFixed(1)}g
                                </div>
                            </div>

                            <div className="hover-box progress-box">
                                Progress
                                <div className="hover-content">
                                    {progress.length === 0
                                        ? <p>No progress logged</p>
                                        : progress.map(p => (
                                            <div key={p.id}>
                                                Weight: {p.person_weight} lbs<br />
                                                Bench: {p.bench} lbs<br />
                                                Squat: {p.squat} lbs<br />
                                                Deadlift: {p.dead_lift} lbs
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default CalendarHistory;
