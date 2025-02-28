import React from 'react';
import { NavLink } from 'react-router-dom';

const NavBar = () => {
  return (
    <div className="nav-bar">
      <NavLink to='/home'>Home</NavLink>
    </div>
  );
};

export default NavBar;
