import { React, useCallback, useState } from 'react';
import SearchIcon from '../assets/searchicon.svg?react';
import VerticalLineIcon from '../assets/verticallineicon.svg?react';

const getSearchResults = async (term) => {
  const sample =
  {
    title: 'Introduction to stem cells.',
    description: `This review discusses the history, definition, and classification of stem cells. Human pluripotent stem cells (hPSCs) 
      mainly include embryonic stem cells (hESCs) and included pluripotent stem cells (hiPSCs). Embryonic stem...`,
    authors: 'Tian Z, Yu T, Liu J, Wang T, Higuchi A. '
  };

  return [
    sample,
    sample,
    sample
  ];
};

const GetStarted = () => {

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState();
  const onSubmit = useCallback(async () => {
    const results = await getSearchResults('');
    setSearchResults(results);
  }, []);

  return (

    <div className='white-border-box'>
      <div className='get-started-content'>
        {!searchResults && (
          <div className='research-topic-text'>
            What research topic would you like to expand your mind?
          </div>
        )}
        <div className='search-container'>
          <input
            type='text'
            placeholder='Search...'
            value={searchTerm}
            className='search-bar'
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <VerticalLineIcon className='vertical-line' />
          <SearchIcon className='search-icon' onClick={onSubmit} />
        </div>
      </div>
      {searchResults && (
        searchResults.map((result) => (
          <div className='papers-results'>
            <div className='title-result'>{result.title}</div>
            <div className='author-result'>{result.authors}</div>
            <div className='description-result'>{result.description}</div>
          </div>
        ))
      )
      }
    </div>
  );
};

export default GetStarted;
