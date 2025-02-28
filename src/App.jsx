import './Styles/App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './Components/Home';

function App() {

  return (
    <div className='app-container'>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </div>
  );
}

export default App;
