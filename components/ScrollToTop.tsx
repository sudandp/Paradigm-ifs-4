import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // Scroll the window to the top
        window.scrollTo(0, 0);

        // Also try to scroll the main content area if it exists
        // This handles cases where the scroll is on a specific element rather than the window
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.scrollTo(0, 0);
        }

        // Also try to scroll the root element
        const rootElement = document.getElementById('root');
        if (rootElement) {
            rootElement.scrollTo(0, 0);
        }

    }, [pathname]);

    return null;
};

export default ScrollToTop;
