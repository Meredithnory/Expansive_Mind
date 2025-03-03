import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import HamburgerIcon from '../assets/hamburger.svg?react';

const Menu = () => {
  const [openMenu, setOpenMenu] = useState(false);
  function handleClick() {
    setOpenMenu(!openMenu);

  }
  console.log(openMenu);

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
          <div onClick={handleClick} className='close'>Close</div>
          <NavLink to='/' className={(navData) => navData.isActive ? 'active' : ''}>Home</NavLink>
          <NavLink to='/login' className={(navData) => navData.isActive ? 'active' : ''}>Log-in</NavLink>
          <NavLink to='/signup' className={(navData) => navData.isActive ? 'active' : ''}>Sign-up</NavLink>
        </div>
      )}
    </div>
  );
};

export default Menu;
