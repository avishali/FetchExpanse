import { useState, useEffect } from 'react';

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let timeoutId: any = null;
    
    const handleResize = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        }, 100); // 100ms debounce
    };

    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(timeoutId);
    };
  }, []);

  return windowSize;
}
