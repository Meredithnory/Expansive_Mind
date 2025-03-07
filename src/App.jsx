import './Styles/App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
//Pages
import Home from './Components/Home';
import TopNavBar from './Components/TopNavBar';
import SignUp from './Components/SignUp';
import Login from './Components/Login';
import GetStarted from './Components/GetStarted';

function App() {

  return (
    <div className='app-container'>
      <TopNavBar />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='*' element={<Navigate to='/' replace />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<SignUp />} />
        <Route path='/get-started' element={<GetStarted />} />
      </Routes>
    </div>
  );
}

export default App;
