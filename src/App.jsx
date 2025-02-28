import './Styles/App.css';
import { Navigate, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom';
import Layout from './Layout';
import Home from './Components/Home';

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path='/' element={<Layout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
      </Route>
    )
  );
  return (
    <div className='app-container'>
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
