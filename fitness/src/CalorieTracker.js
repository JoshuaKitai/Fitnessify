import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function CalorieTracker() {
    const [entries, setEntries] = useState([]);
    const [query, setQuery] = useState('');
    const [lookupData, setLookupData] = useState(null);
    const [showTable, setShowTable] = useState(true);

    const fetchEntries = async () => {
        const res = await fetch('http://localhost:5000/entries/today');
        const data = await res.json();
        setEntries(data);
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    const handleLookup = async (e) => {
        e.preventDefault();
        const res = await fetch('http://localhost:5000/api/nutritionix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        setLookupData(data);
    };

    const handleAddFood = async () => {
        if (lookupData && !lookupData.error) {
            const res = await fetch('http://localhost:5000/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: lookupData.food_name,
                    calories: lookupData.calories,
                    protein: lookupData.protein,
                    carbs: lookupData.carbs,
                    fat: lookupData.fat
                })
            });

            if (res.ok) {
                fetchEntries();
                setLookupData(null);
                setQuery('');
            }
        }
    };
    const handleDelete = async (id) => {
        const res = await fetch(`http://localhost:5000/entries/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            fetchEntries();
        }
    };

    const totals = entries.reduce((acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fats: acc.fats + e.fat
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

    const macroData = [
        { name: 'Protein', value: totals.protein },
        { name: 'Carbs', value: totals.carbs },
        { name: 'Fat', value: totals.fats }
    ];



    return (
        <div className="calorie-tracker">
            <h2>Calorie Tracker</h2>

            <form onSubmit={handleLookup}>
                <input
                    type="text"
                    placeholder="Enter food item (e.g., 1 cup of rice)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    required
                />
                <button type="submit">Lookup Nutrition</button>
            </form>

            {lookupData && !lookupData.error && (
                <div>
                    <p>
                        <strong>{lookupData.food_name}</strong> — {lookupData.calories} kcal, {lookupData.protein}g protein, {lookupData.carbs}g carbs, {lookupData.fat}g fat
                    </p>
                    <button onClick={handleAddFood}>Add Food</button>
                </div>
            )}

            <button onClick={() => setShowTable(!showTable)}>
                {showTable ? 'Hide Entries' : 'Show Entries'}
            </button>
            <h3>Food Entries Today</h3>
            {showTable && (
              <>
                <table>
                    <thead>
                        <tr>
                            <th>Food</th>
                            <th>Calories</th>
                            <th>Protein (g)</th>
                            <th>Carbs (g)</th>
                            <th>Fats (g)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => (
                            <tr key={entry.id}>
                                <td>{entry.name}</td>
                                <td>{entry.calories.toFixed(1)}</td>
                                <td>{entry.protein.toFixed(1)}</td>
                                <td>{entry.carbs.toFixed(1)}</td>
                                <td>{entry.fat.toFixed(1)}</td>
                                <td>
                                    <button onClick={() => handleDelete(entry.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <h3>Macronutrient Breakdown</h3>
                {macroData.length > 0 && (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={macroData}
                                dataKey="value"
                                nameKey="name"
                                outerRadius={100}
                                fill="#8884d8"
                                label={({ name, value }) => `${name}: ${value.toFixed(1)}g`}
                            >
                                <Cell fill="#82ca9d" />
                                <Cell fill="#ffc658" />
                                <Cell fill="#ff8042" />
                            </Pie>
                            <Tooltip formatter={(value) => `${value.toFixed(1)}g`} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                )}
              </>
            )}

            <div className="totals">
                <h3>Total Intake</h3>
                <p>Calories: {totals.calories.toFixed(1)} kcal</p>
                <p>Protein: {totals.protein.toFixed(1)} g</p>
                <p>Carbs: {totals.carbs.toFixed(1)} g</p>
                <p>Fats: {totals.fats.toFixed(1)} g</p>
            </div>
        </div>
    );
}

export default CalorieTracker;
