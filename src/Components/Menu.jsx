import { useState } from 'react';
import { NavLink } from 'react-router-dom';
//Icons
import HamburgerIcon from '../assets/hamburger.svg?react';
import MapIcon from '../assets/mapicon.svg?react';
import SignUpIcon from '../assets/signupicon.svg?react';
import LoginIcon from '../assets/loginicon.svg?react';
import DoubleArrowIcon from '../assets/doublearrowicon.svg?react';

const Menu = () => {
  const [openMenu, setOpenMenu] = useState(false);
  function handleClick() {
    setOpenMenu(!openMenu);
  }

  return (
    <div className='top-nav-menu'>
      {!openMenu && (
        <div className='closed-menu'>
          <div className='top-nav-text'>
            Menu
          </div>
          <HamburgerIcon className='hamburger-icon' onClick={handleClick} />
        </div>
      )}
      {openMenu && (
        <div className='open-menu'>
          <div onClick={handleClick} className='close'>
            <DoubleArrowIcon className='menu-icon' />
            Close
          </div>
          <NavLink to='/' className={(navData) => navData.isActive ? 'active' : ''} onClick={handleClick}>
            <MapIcon className='menu-icon' />
            <span className='menu-text'>Home</span>
          </NavLink>
          <NavLink to='/login' className={(navData) => navData.isActive ? 'active' : ''} onClick={handleClick}>
            <SignUpIcon className='menu-icon' />
            <span className='menu-text'>Log-in</span>
          </NavLink>
          <NavLink to='/signup' className={(navData) => navData.isActive ? 'active' : ''} onClick={handleClick}>
            <LoginIcon className='menu-icon' />
            <span className='menu-text'>Sign-up</span>
          </NavLink>
        </div>
      )}
    </div>
  );
};

export default Menu;
