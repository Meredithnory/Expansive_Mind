import React from 'react';

const ResultTitle = ({ title, searchTerm }) => {

  const startingIndex = title.toLowerCase().indexOf(searchTerm.toLowerCase());
  const endingIndex = startingIndex + searchTerm.length;

  const beforeTerm = title.substring(0, startingIndex);
  const foundTerm = title.substring(startingIndex, endingIndex);
  const afterTerm = title.substring(endingIndex);

  return (
    <div className='title-result'>
      {startingIndex !== -1 ? (
        <>
          {beforeTerm}<span className='blue-color-text'>{foundTerm}</span>{afterTerm}
        </>
      )
        :
        (
          <>
            {title}
          </>
        )
      }
    </div>

  );
};

export default ResultTitle;
