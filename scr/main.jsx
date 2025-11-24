import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Tao đã bỏ cái <React.StrictMode> đi rồi, giờ nó chạy 1 lần thôi cho mượt
ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)
