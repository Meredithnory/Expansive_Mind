import { React, useCallback, useState } from 'react';
import SearchIcon from '../assets/searchicon.svg?react';
import VerticalLineIcon from '../assets/verticallineicon.svg?react';
import ResultTitle from './ResultTitle';
import { NavLink } from 'react-router-dom';



const getSearchResults = async (term) => {
  const sample =
  {
    title: 'Introduction to stem cells.',
    description: `This review discusses the history, definition, and classification of stem cells. Human pluripotent stem cells (hPSCs) 
      mainly include embryonic stem cells (hESCs) and included pluripotent stem cells (hiPSCs). Embryonic stem...`,
    authors: 'Tian Z, Yu T, Liu J, Wang T, Higuchi A. ',
    PMID: '23257690',
    abstract: 'Abstract Stem cells have self-renewal capability and can proliferate and differentiate into a variety of functionally active cells that can serve in various tissues and organs. This review discusses the history, definition, and classification of stem cells. Human pluripotent stem cells (hPSCs) mainly include embryonic stem cells (hESCs) and induced pluripotent stem cells (hiPSCs). Embryonic stem cells are derived from the inner cell mass of the embryo. Induced pluripotent stem cells are derived from reprogramming somatic cells. Pluripotent stem cells have the ability to differentiate into cells derived from all three germ layers (endoderm, mesoderm, and ectoderm). Adult stem cells can be multipotent or unipotent and can produce tissue-specific terminally differentiated cells. Stem cells can be used in cell therapy to replace and regenerate damaged tissues or organs.',
    Introduction: 'Introduction Stem cells exist in embryonic tissues as well as adult or fetal tissues such as bone marrow (bone marrow stem cells, BMSCs), fat (adipose-derived stem cells, ADSCs), dental pulp (dental pulp stem cells, DPSCs), blood (hematopoietic stem cells, HSCs), amniotic fluid (amniotic fluid stem cells, AFSCs), umbilical cord (umbilical cord stem cells, UCSCs) and even other tissues.1, 2, 3, 4, 5, 6 Stem cells are a class of undifferentiated cells with high potential for self-renewal, proliferation, and mono- or multidirectional differentiation. A totipotent stem cells (a single fertilized egg) can develop into more than 250 cell types (depending on the definition of cell types) throughout human or animal life.7, 8, 9'
  };

  return [
    sample,
    sample,
    sample
  ];
};

const GetStarted = () => {

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const onSubmit = useCallback(async () => {
    const results = await getSearchResults('');
    setSearchResults(results);
  }, []);
  console.log('searchTerm', searchTerm);

  return (

    <div className={`white-border-box ${searchResults.length > 0 ? 'top-positioned' : ''}`}>
      <div className='get-started-content'>
        {searchResults.length === 0 && (
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
          <div className='search-vline-icon-area'>
            <VerticalLineIcon className='vertical-line' />
            <SearchIcon className='search-icon' onClick={onSubmit} />
          </div>
        </div>
      </div>
      {searchResults.length > 0 && (
        <div className='search-area'>
          <div className='filter-by'>
            <div className='filter-by-text'>
              <span>Filter by: </span>
              <span>Publication Date</span>
            </div>
            <div className='checkboxes-area'>
              <div className='one-checkbox-area'>
                <button className='checkbox'></button>
                <span>1 year</span>
              </div>
              <div className='one-checkbox-area'>
                <button className='checkbox'></button>
                <span>5 years</span>
              </div>
              <div className='one-checkbox-area'>
                <button className='checkbox'></button>
                <psan>10 years</psan>
              </div>
            </div>
          </div>

          <div className='paper-results-area'>
            {searchResults.map((result) => (
              <NavLink to='/chat-bot' className={(navData) => navData.isActive ? 'active' : ''}>
                <div className='paper-result'>
                  <ResultTitle title={result.title} searchTerm={searchTerm} />
                  <div className='author-result'>{result.authors}</div>
                  <div className='description-result'>{result.description}</div>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      )
      }
    </div>
  );
};

export default GetStarted;
// ${(result.title.toLowerCase().includes(searchTerm.toLowerCase()))
//   ?
//   'blue-color-text'
//   :
//   ''
//   }`