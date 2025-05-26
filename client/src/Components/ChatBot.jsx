import React from 'react';
import DoubleLeftArrow from '../assets/doubleleftarrow.svg?react';
import HighlightIcon from '../assets/highlighticon.svg?react';
import DownloadIcon from '../assets/downloadicon.svg?react';
import DoubleUpArrow from '../assets/doubleuparrow.svg?react';
import { Link } from 'react-router-dom';

const ChatBot = () => {
  return (

    <div className='main-paper-area'>
      <div className='top-main-paper-area'>
        <div className='back-to-search-area'>
          <Link to='/get-started'>
            <DoubleLeftArrow className='double-left-arrow-icon' />
          </Link>
          <span>Back to Search</span>
        </div>

        <div className='tools-area'>
          <span>Tools</span>
          <HighlightIcon className='highlight-icon' />
          <DownloadIcon className='download-icon' />
        </div>
      </div>

      <div className='chat-bot-and-paper-area'>
        <div className='chat-bot-box-area'>
          <div className='chat-bot-box-grey'>
          </div>
          <div className='chat-area'>
            <div className='chat'>
              <div className='chat-enter'>
                <DoubleUpArrow className='double-up-arrow-icon' />

              </div>

            </div>
          </div>

        </div>
        <div className='paper-result-area'>

        </div>
      </div>

    </div>
  );
};

export default ChatBot;
