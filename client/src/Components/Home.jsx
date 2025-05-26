import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className='home-content'>
      <div>
        <div className='welcome-to-text'>
          Welcome to
        </div>
        <div className='expansive-mind-text'>
          Expansive Mind
        </div>
      </div>
      <div className='button-content'>
        <button className='home-button'>
          <Link to='/get-started'>
            Get Started
          </Link>
        </button>
        <button className='home-button'>
          <Link to='/login'>
            Log-in
          </Link>
        </button>
      </div>
    </div>
  );
};

export default Home;
